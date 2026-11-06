/* ===== 云享 CloudShare · 文件预览页逻辑 ===== */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const key = params.get("key");

  function toast(msg, type) {
    const el = $("#toast");
    el.textContent = msg; el.className = "toast" + (type ? " " + type : ""); el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, 2400);
  }

  function extOf(name) { return (name || "").split(".").pop().toLowerCase(); }

  async function init() {
    if (!key) { $("#previewBox").innerHTML = '<div class="preview-empty">缺少文件参数</div>'; return; }
    $("#pvTitle").textContent = CSUtil.fileIcon("", key) + " " + key;
    try {
      const { url, type } = await ObsClient.getPreviewData(key);
      const box = $("#previewBox");
      if (!url) { box.innerHTML = '<div class="preview-empty">无法获取预览内容<br/><span class="muted small">演示模式下仅小于 5MB 的文件可预览</span></div>'; return; }

      const ext = extOf(key);
      const isImage = (type && type.startsWith("image/")) || ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"].includes(ext);
      const isText = (type && (type.startsWith("text/") || type.includes("json") || type.includes("xml") || type.includes("javascript"))) || ["txt", "md", "json", "js", "ts", "css", "html", "xml", "csv", "py", "java", "go", "log"].includes(ext);
      const isPdf = (type && type === "application/pdf") || ext === "pdf";
      const isAudio = (type && type.startsWith("audio/")) || ["mp3", "wav", "ogg", "m4a"].includes(ext);
      const isVideo = (type && type.startsWith("video/")) || ["mp4", "webm", "mov", "avi", "mkv"].includes(ext);

      if (isImage) {
        box.innerHTML = `<img class="preview-img" src="${url}" alt="${key}" />`;
      } else if (isVideo) {
        box.innerHTML = `<video class="preview-media" controls src="${url}"></video>`;
      } else if (isAudio) {
        box.innerHTML = `<audio class="preview-media" controls src="${url}"></audio>`;
      } else if (isPdf) {
        box.innerHTML = `<iframe class="preview-frame" src="${url}"></iframe>`;
      } else if (isText) {
        try {
          const res = await fetch(url); const text = await res.text();
          box.innerHTML = `<pre class="preview-text">${text.replace(/</g, "&lt;")}</pre>`;
        } catch (e) {
          box.innerHTML = `<iframe class="preview-frame" src="${url}"></iframe>`;
        }
      } else {
        box.innerHTML = `<div class="preview-empty">该文件类型暂不支持在线预览<br/><button class="btn btn-primary" id="dlBtn">⬇️ 下载文件</button></div>`;
        const dl = $("#dlBtn"); if (dl) dl.addEventListener("click", () => download(url));
      }
    } catch (e) {
      $("#previewBox").innerHTML = '<div class="preview-empty">加载失败：' + e.message + '</div>';
    }

    $("#btnDownload").addEventListener("click", async () => {
      try { const { url } = await ObsClient.getPreviewData(key); download(url); }
      catch (e) { toast("下载失败：" + e.message, "err"); }
    });
  }

  function download(url) {
    if (!url || url === "about:blank") { toast("无可下载地址", "err"); return; }
    const a = document.createElement("a"); a.href = url; a.download = key || ""; a.target = "_blank"; document.body.appendChild(a); a.click(); a.remove();
  }

  init();
})();