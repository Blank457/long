/* ===== FunctionGraph 函数：sts-token
   功能：
   1) GET  /sts-token        下发 OBS 临时访问凭证（STS），前端用其直传 OBS
   2) POST /presign          生成预签名 URL（PUT 上传 / GET 下载）
   3) GET  /list?bucket=     列出桶内对象
   4) POST /delete           删除对象

   部署：在华为云 FunctionGraph 创建 Node.js 18 函数，上传本目录打包产物，
   配置触发器 APIG（HTTP），环境变量见下方 ENV 说明。
*/
const obs = require("@huaweicloud/hcs-sdk-obs");
const iam = require("@huaweicloud/hcs-sdk-iam");

const {
  OBS_AK, OBS_SK,
  OBS_ENDPOINT = "obs.cn-north-4.myhuaweicloud.com",
  OBS_BUCKET,
  IAM_ENDPOINT = "iam.cn-north-4.myhuaweicloud.com",
  IAM_DOMAIN, IAM_PROJECT_ID,
  STS_DURATION = "3600",
  ALLOW_PREFIX = "",
  REGION = "cn-north-4"
} = process.env;

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(code, body) {
  return { statusCode: code, headers: { "Content-Type": "application/json", ...cors() }, body: JSON.stringify(body) };
}

function route(event) {
  const method = (event.httpMethod || "GET").toUpperCase();
  const path = (event.path || "").replace(/^\/+/, "");
  if (method === "OPTIONS") return { statusCode: 204, headers: cors(), body: "" };
  if (method === "GET" && path.endsWith("sts-token")) return "sts";
  if (method === "POST" && path.endsWith("presign")) return "presign";
  if (method === "GET" && path.endsWith("list")) return "list";
  if (method === "POST" && path.endsWith("delete")) return "delete";
  return null;
}

function createObsClient(ak, sk, token) {
  return new obs.OBSClient({
    access_key_id: ak,
    secret_access_key: sk,
    security_token: token,
    server: "https://" + OBS_ENDPOINT,
    isSecurity: true
  });
}

async function getStsCredentials() {
  const iamClient = new iam.IAMClient({
    accessKeyId: OBS_AK,
    secretAccessKey: OBS_SK,
    endpoint: "https://" + IAM_ENDPOINT,
    region: REGION,
    domainId: IAM_DOMAIN,
    projectId: IAM_PROJECT_ID
  });
  const agencyName = process.env.IAM_AGENCY || "cloudshare_obs_agency";
  const resp = await iamClient.createTemporaryAccessKeyByAgency({
    duration_seconds: parseInt(STS_DURATION, 10),
    agency_name: agencyName,
    project: { id: IAM_PROJECT_ID }
  });
  const c = resp.credential;
  return { ak: c.access, sk: c.secret, token: c.securitytoken };
}

exports.handler = async function (event, context) {
  const logger = context && context.getLogger ? context.getLogger() : console;
  try {
    const action = route(event);
    if (!action) return json(404, { error: "not found" });

    if (action === "sts") {
      const cred = await getStsCredentials();
      return json(200, {
        ak: cred.ak, sk: cred.sk, token: cred.token,
        bucket: OBS_BUCKET, endpoint: OBS_ENDPOINT, expire: STS_DURATION
      });
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const bucket = body.bucket || OBS_BUCKET;
    const client = createObsClient(OBS_AK, OBS_SK);

    if (action === "presign") {
      const method = (body.method || "GET").toUpperCase();
      const key = body.key;
      const contentType = body.contentType || "application/octet-stream";
      const url = await new Promise((resolve, reject) => {
        client.getSignedUrl(method.toLowerCase() === "put" ? "putObject" : "getObject", {
          Bucket: bucket, Key: key, Expires: 3600,
          ContentType: contentType
        }, (err, u) => err ? reject(err) : resolve(u));
      });
      return json(200, { url });
    }

    if (action === "list") {
      const data = await new Promise((resolve, reject) => {
        client.listObjects({ Bucket: bucket, MaxKeys: 200, Prefix: ALLOW_PREFIX }, (err, d) => err ? reject(err) : resolve(d));
      });
      const items = (data.Contents || []).map(o => ({ key: o.Key, size: Number(o.Size), lastModified: o.LastModified, etag: o.ETag }));
      return json(200, items);
    }

    if (action === "delete") {
      await new Promise((resolve, reject) => {
        client.deleteObject({ Bucket: bucket, Key: body.key }, err => err ? reject(err) : resolve());
      });
      return json(200, { ok: true });
    }

    return json(404, { error: "unknown action" });
  } catch (e) {
    logger.error("sts-token error: " + (e && e.message));
    return json(500, { error: e && e.message || "internal error" });
  }
};