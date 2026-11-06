/* ===== 云享 CloudShare · OBS 客户端封装 =====
   支持两种模式：
   1) 真实模式：页面加载华为云 OBS Browser JS SDK（全局 obs.OBSClient），并配置 AK/SK 或 STS 函数地址
   2) 演示模式：未加载 SDK 或未配置时，使用 localStorage 模拟，便于无云环境演示完整交互
*/
(function (global) {
  "use strict";

  const SHARE_KEY = "cloudshare_shares_v1";
  const DEMO_FILE_KEY = "cloudshare_demo_files_v1";

  function hasObsSdk() {
    return !!(global.obs && global.obs.OBSClient);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function nowStr() {
    return new Date().toISOString();
  }

  function fmtSize(b) {
    if (b == null) return "-";
    const u = ["B", "KB", "MB", "GB", "TB"];
    let i = 0, n = Number(b);
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return n.toFixed(n < 10 && i > 0 ? 1 : 0) + " " + u[i];
  }

  function fileIcon(type, name) {
    const ext = (name || "").split(".").pop().toLowerCase();
    if (type && type.startsWith("image/")) return "🖼️";
    if (type && type.startsWith("video/")) return "🎬";
    if (type && type.startsWith("audio/")) return "🎵";
    if (["pdf"].includes(ext)) return "📕";
    if (["doc", "docx"].includes(ext)) return "📄";
    if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
    if (["zip", "rar", "7z", "gz", "tar"].includes(ext)) return "🗜️";
    if (["js", "ts", "json", "html", "css", "py", "java", "go", "md", "txt"].includes(ext)) return "📝";
    return "📦";
  }

  function loadShares() {
    try { return JSON.parse(localStorage.getItem(SHARE_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveShares(list) {
    localStorage.setItem(SHARE_KEY, JSON.stringify(list));
  }

  function loadDemoFiles() {
    try { return JSON.parse(localStorage.getItem(DEMO_FILE_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveDemoFiles(list) {
    localStorage.setItem(DEMO_FILE_KEY, JSON.stringify(list));
  }

  function makeCode() {
    const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let r = "";
    for (let i = 0; i < 6; i++) r += s[Math.floor(Math.random() * s.length)];
    return r;
  }

  function createClient(cfg) {
    if (!hasObsSdk()) return null;
    const params = {
      access_key_id: cfg.ak,
      secret_access_key: cfg.sk,
      server: "https://" + cfg.endpoint,
      isSecurity: true
    };
    return new global.obs.OBSClient(params);
  }

  const ObsClient = {
    mode: "demo",
    client: null,
    cfg: null,

    init(cfg) {
      this.cfg = cfg;
      if (hasObsSdk() && cfg.bucket && cfg.endpoint && (cfg.ak && cfg.sk)) {
        this.client = createClient(cfg);
        this.mode = "obs";
      } else if (cfg.bucket && cfg.endpoint && cfg.stsUrl) {
        this.mode = "sts";
      } else {
        this.mode = "demo";
      }
      return this.mode;
    },

    isDemo() { return this.mode === "demo"; },

    async listFiles() {
      if (this.mode === "obs" && this.client) {
        return new Promise((resolve, reject) => {
          this.client.listObjects({ Bucket: this.cfg.bucket, MaxKeys: 200 }, (err, data) => {
            if (err) return reject(err);
            const items = (data.Contents || []).map(o => ({
              key: o.Key,
              size: Number(o.Size),
              etag: o.ETag,
              lastModified: o.LastModified,
              type: ""
            }));
            resolve(items);
          });
        });
      }
      if (this.mode === "sts") {
        const res = await fetch(this.cfg.stsUrl.replace(/\/$/, "") + "/list?bucket=" + encodeURIComponent(this.cfg.bucket));
        if (!res.ok) throw new Error("STS list 失败: " + res.status);
        return res.json();
      }
      return loadDemoFiles().map(f => ({
        key: f.key, size: f.size, lastModified: f.lastModified, type: f.type, etag: f.etag
      }));
    },

    async uploadFile(file, onProgress) {
      const key = file.name;
      if (this.mode === "obs" && this.client) {
        return new Promise((resolve, reject) => {
          this.client.putObject({
            Bucket: this.cfg.bucket,
            Key: key,
            Body: file,
            ContentType: file.type || "application/octet-stream"
          }, (err, data) => {
            if (err) return reject(err);
            resolve({ key, etag: data.ETag });
          });
        });
      }
      if (this.mode === "sts") {
        const presign = await fetch(this.cfg.stsUrl.replace(/\/$/, "") + "/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket: this.cfg.bucket, key, method: "PUT", contentType: file.type })
        });
        const { url } = await presign.json();
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        return new Promise((resolve, reject) => {
          xhr.upload.onprogress = e => {
            if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
          };
          xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve({ key }) : reject(new Error("上传失败 " + xhr.status));
          xhr.onerror = () => reject(new Error("网络错误"));
          xhr.send(file);
        });
      }
      await new Promise(r => {
        let loaded = 0;
        const step = Math.max(1, Math.floor(file.size / 20));
        const timer = setInterval(() => {
          loaded += step;
          if (loaded >= file.size) {
            loaded = file.size; clearInterval(timer); r();
          }
          if (onProgress) onProgress(loaded / file.size);
        }, 40);
      });
      const list = loadDemoFiles();
      const exist = list.findIndex(f => f.key === key);
      const item = {
        key, size: file.size, type: file.type || "application/octet-stream",
        lastModified: nowStr(), etag: uid()
      };
      if (exist >= 0) list[exist] = item; else list.unshift(item);
      saveDemoFiles(list);
      return { key, etag: item.etag };
    },

    async deleteFile(key) {
      if (this.mode === "obs" && this.client) {
        return new Promise((resolve, reject) => {
          this.client.deleteObject({ Bucket: this.cfg.bucket, Key: key }, err => err ? reject(err) : resolve());
        });
      }
      if (this.mode === "sts") {
        await fetch(this.cfg.stsUrl.replace(/\/$/, "") + "/delete", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket: this.cfg.bucket, key })
        });
        return;
      }
      saveDemoFiles(loadDemoFiles().filter(f => f.key !== key));
    },

    async getDownloadUrl(key) {
      if (this.mode === "obs" && this.client) {
        return new Promise((resolve, reject) => {
          this.client.getSignedUrl("getObject", { Bucket: this.cfg.bucket, Key: key, Expires: 3600 }, (err, url) => err ? reject(err) : resolve(url));
        });
      }
      if (this.mode === "sts") {
        const res = await fetch(this.cfg.stsUrl.replace(/\/$/, "") + "/presign", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket: this.cfg.bucket, key, method: "GET" })
        });
        const { url } = await res.json();
        return url;
      }
      const f = loadDemoFiles().find(f => f.key === key);
      if (f && f.dataUrl) return f.dataUrl;
      return "about:blank";
    },

    async getPreviewData(key) {
      if (this.isDemo()) {
        const f = loadDemoFiles().find(f => f.key === key);
        return { url: f && f.dataUrl ? f.dataUrl : null, type: f ? f.type : "" };
      }
      const url = await this.getDownloadUrl(key);
      return { url, type: "" };
    },

    async createShare(key, opts) {
      const expireHours = Number(opts.expireHours) || 0;
      const useCode = !!opts.useCode;
      const code = useCode ? (opts.code || makeCode()) : "";
      const id = uid();
      const created = Date.now();
      const expire = expireHours > 0 ? created + expireHours * 3600 * 1000 : 0;
      let downloadUrl = "";
      try { downloadUrl = await this.getDownloadUrl(key); } catch (e) {}
      const share = {
        id, key, code, useCode, created, expire, downloadUrl,
        link: location.origin + location.pathname.replace(/[^/]*$/, "") + "share.html?id=" + id
      };
      const list = loadShares();
      list.unshift(share);
      saveShares(list);
      return share;
    },

    listShares() { return loadShares(); },

    getShare(id) { return loadShares().find(s => s.id === id); },

    deleteShare(id) {
      saveShares(loadShares().filter(s => s.id !== id));
    },

    isShareExpired(s) { return s && s.expire > 0 && Date.now() > s.expire; },

    _demoStoreDataUrl(key, dataUrl) {
      const list = loadDemoFiles();
      const f = list.find(f => f.key === key);
      if (f) { f.dataUrl = dataUrl; saveDemoFiles(list); }
    }
  };

  global.ObsClient = ObsClient;
  global.CSUtil = { uid, nowStr, fmtSize, fileIcon, makeCode };
})(window);