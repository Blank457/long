/* ===== 云享 CloudShare · 分享访问页逻辑 ===== */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  function toast(msg, type) {
    const el = $("#toast");
    el.textContent = msg; el.className = "toast" + (type ? " " + type : ""); el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, 2400);
  }

  function show(step) {
    ["stepCode", "stepReady", "stepError"].forEach(s => $("#" + s).hidden = (s !== step));
  }

  function init() {
    if (!id) { $("#errHint").textContent = "缺少分享 ID"; show("stepError"); return; }
    const s = ObsClient.getShare(id);
    if (!s) { show("stepError"); return; }
    if (ObsClient.isShareExpired(s)) { $("#errHint").textContent = "该分享已于 " + new Date(s.expire).toLocaleString("zh-CN") + " 过期"; show("stepError"); return; }

    if (s.useCode) {
      show("stepCode");
      $("#codeInput").focus();
      $("#btnVerify").addEventListener("click", verify);
      $("#codeInput").addEventListener("keydown", e => { if (e.key === "Enter") verify(); });
    } else {
      showReady(s);
    }

    function verify() {
      const input = $("#codeInput").value.trim().toUpperCase();
      if (input !== s.code.toUpperCase()) { toast("提取码错误", "err"); return; }
      showReady(s);
    }
  }

  function showReady(s) {
    show("stepReady");
    $("#fileName").textContent = s.key;
    const expireTxt = s.expire === 0 ? "永久有效" : "有效期至 " + new Date(s.expire).toLocaleString("zh-CN");
    $("#fileMeta").textContent = expireTxt;
    $("#btnPreview").addEventListener("click", () => {
      location.href = "preview.html?key=" + encodeURIComponent(s.key) + "&share=" + s.id;
    });
    $("#btnDownload").addEventListener("click", async () => {
      try {
        const url = await ObsClient.getDownloadUrl(s.key);
        if (url && url !== "about:blank") {
          const a = document.createElement("a"); a.href = url; a.download = s.key; a.target = "_blank"; document.body.appendChild(a); a.click(); a.remove();
        } else { toast("演示模式下请点击在线预览查看", ""); }
      } catch (e) { toast("下载失败：" + e.message, "err"); }
    });
  }

  init();
})();