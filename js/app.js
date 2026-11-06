/* ===== 云享 CloudShare · 主应用逻辑 ===== */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const cfg = CloudShareConfig.load();
  let connected = false;

  function toast(msg, type) {
    const el = $("#toast");
    el.textContent = msg;
    el.className = "toast" + (type ? " " + type : "");
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2400);
  }

  function setConn(status) {
    const el = $("#connStatus");
    if (status === "ok") { el.textContent = "已连接 · " + (ObsClient.isDemo() ? "演示模式" : "OBS"); el.className = "badge ok"; connected = true; }
    else if (status === "sts") { el.textContent = "已连接 · STS"; el.className = "badge ok"; connected = true; }
    else { el.textContent = "未连接"; el.className = "badge err"; connected = false; }
  }

  function openModal(id) { const m = $("#" + id); m.hidden = false; }
  function closeModal(m) { m.hidden = true; }
  $$(".modal").forEach(m => {
    m.addEventListener("click", e => { if (e.target === m || e.target.hasAttribute("data-close")) closeModal(m); });
  });

  function updateStats(files, shares) {
    $("#statFiles").textContent = files.length;
    $("#statSize").textContent = CSUtil.fmtSize(files.reduce((a, f) => a + (f.size || 0), 0));
    $("#statShares").textContent = shares.length;
  }

  function renderFiles(list) {
    const tb = $("#fileTableBody");
    if (!list.length) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="5">暂无文件，请先上传或配置华为云连接</td></tr>';
      return;
    }
    const kw = ($("#searchInput").value || "").trim().toLowerCase();
    const data = kw ? list.filter(f => f.key.toLowerCase().includes(kw)) : list;
    if (!data.length) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="5">未匹配到文件</td></tr>';
      return;
    }
    tb.innerHTML = data.map(f => {
      const icon = CSUtil.fileIcon(f.type, f.key);
      const time = f.lastModified ? new Date(f.lastModified).toLocaleString("zh-CN") : "-";
      return `<tr>
        <td><div class="fname"><span class="ficon">${icon}</span><span class="fname-text" title="${f.key}">${f.key}</span></div></td>
        <td>${CSUtil.fmtSize(f.size)}</td>
        <td>${f.type || "-"}</td>
        <td>${time}</td>
        <td><div class="row-actions">
          <button class="btn" data-act="preview" data-key="${f.key}">👁 预览</button>
          <button class="btn" data-act="share" data-key="${f.key}">🔗 分享</button>
          <button class="btn btn-danger" data-act="delete" data-key="${f.key}">🗑</button>
        </div></td>
      </tr>`;
    }).join("");
  }

  function renderShares(list) {
    const tb = $("#shareTableBody");
    if (!list.length) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="5">暂无分享</td></tr>';
      return;
    }
    tb.innerHTML = list.map(s => {
      const expired = ObsClient.isShareExpired(s);
      const expireTxt = s.expire === 0 ? "永久" : new Date(s.expire).toLocaleString("zh-CN");
      const codeTxt = s.useCode ? s.code : "无";
      return `<tr${expired ? ' style="opacity:.5"' : ""}>
        <td title="${s.key}">${s.key}${expired ? ' <span class="muted small">(已过期)</span>' : ""}</td>
        <td><code>${codeTxt}</code></td>
        <td>${expireTxt}</td>
        <td><input class="input" readonly value="${s.link}" style="font-size:12px" /></td>
        <td><div class="row-actions">
          <button class="btn" data-act="copy" data-link="${s.link}">复制</button>
          <button class="btn btn-danger" data-act="delshare" data-id="${s.id}">🗑</button>
        </div></td>
      </tr>`;
    }).join("");
  }

  async function refreshAll() {
    if (!connected) { updateStats([], []); renderFiles([]); renderShares([]); return; }
    try {
      const files = await ObsClient.listFiles();
      renderFiles(files);
      const shares = ObsClient.listShares();
      renderShares(shares);
      updateStats(files, shares);
    } catch (e) {
      toast("加载失败：" + e.message, "err");
    }
  }

  function addUploadItem(name, size) {
    const list = $("#uploadList");
    const item = document.createElement("div");
    item.className = "upload-item";
    item.innerHTML = `<span class="ficon">${CSUtil.fileIcon("", name)}</span>
      <span class="name" title="${name}">${name}</span>
      <span class="muted small">${CSUtil.fmtSize(size)}</span>
      <div class="bar"><i></i></div>
      <span class="pct">0%</span>`;
    list.appendChild(item);
    return {
      set(p) { item.querySelector(".bar > i").style.width = (p * 100).toFixed(0) + "%"; item.querySelector(".pct").textContent = (p * 100).toFixed(0) + "%"; },
      done() { item.classList.add("done"); item.querySelector(".pct").textContent = "完成"; },
      err(msg) { item.classList.add("err"); item.querySelector(".pct").textContent = "失败"; item.querySelector(".name").textContent += " (" + msg + ")"; }
    };
  }

  async function uploadFiles(fileList) {
    if (!connected) { toast("请先配置华为云连接", "err"); openModal("settingsModal"); return; }
    const files = Array.from(fileList);
    for (const file of files) {
      const ui = addUploadItem(file.name, file.size);
      try {
        await ObsClient.uploadFile(file, p => ui.set(p));
        if (ObsClient.isDemo() && file.size < 5 * 1024 * 1024) {
          const reader = new FileReader();
          reader.onload = () => ObsClient._demoStoreDataUrl(file.name, reader.result);
          reader.readAsDataURL(file);
        }
        ui.done();
      } catch (e) {
        ui.err(e.message);
      }
    }
    toast("上传完成", "ok");
    refreshAll();
  }

  const dropZone = $("#dropZone");
  const fileInput = $("#fileInput");
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => { if (fileInput.files.length) uploadFiles(fileInput.files); fileInput.value = ""; });
  ["dragenter", "dragover"].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove("dragover"); }));
  dropZone.addEventListener("drop", e => { if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); });

  $("#files").addEventListener("click", async e => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const act = btn.dataset.act, key = btn.dataset.key;
    if (act === "preview") {
      location.href = "preview.html?key=" + encodeURIComponent(key);
    } else if (act === "share") {
      openShareModal(key);
    } else if (act === "delete") {
      if (!confirm("确认删除文件 " + key + " ？")) return;
      try { await ObsClient.deleteFile(key); toast("已删除", "ok"); refreshAll(); }
      catch (e) { toast("删除失败：" + e.message, "err"); }
    }
  });

  $("#shares").addEventListener("click", e => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "copy") { copyText(btn.dataset.link); toast("链接已复制", "ok"); }
    else if (act === "delshare") { ObsClient.deleteShare(btn.dataset.id); toast("已取消分享", "ok"); refreshAll(); }
  });

  let currentShareKey = "";
  function openShareModal(key) {
    currentShareKey = key;
    $("#shareFileName").value = key;
    $("#shareExpire").value = "24";
    $("#shareUseCode").checked = true;
    $("#shareCode").value = "";
    $("#shareResult").hidden = true;
    openModal("shareModal");
  }

  $("#btnGenShare").addEventListener("click", async () => {
    if (!currentShareKey) return;
    const opts = {
      expireHours: Number($("#shareExpire").value),
      useCode: $("#shareUseCode").checked,
      code: $("#shareCode").value.trim()
    };
    try {
      const s = await ObsClient.createShare(currentShareKey, opts);
      $("#shareLink").value = s.link;
      $("#shareResult").hidden = false;
      const tip = s.useCode ? "提取码：" + s.code + "，有效期：" + (s.expire === 0 ? "永久" : new Date(s.expire).toLocaleString("zh-CN")) : "无需提取码，有效期：" + (s.expire === 0 ? "永久" : new Date(s.expire).toLocaleString("zh-CN"));
      $("#shareTip").textContent = tip;
      toast("分享已生成", "ok");
      refreshAll();
    } catch (e) {
      toast("生成失败：" + e.message, "err");
    }
  });

  $("#btnCopyLink").addEventListener("click", () => { copyText($("#shareLink").value); toast("链接已复制", "ok"); });

  function copyText(t) {
    if (navigator.clipboard) { navigator.clipboard.writeText(t).catch(() => {}); }
    else { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta); }
  }

  $("#searchInput").addEventListener("input", () => { refreshAll(); });
  $("#btnRefresh").addEventListener("click", () => { refreshAll(); toast("已刷新", "ok"); });

  $("#btnSettings").addEventListener("click", () => {
    const c = CloudShareConfig.load();
    $("#cfgBucket").value = c.bucket;
    $("#cfgEndpoint").value = c.endpoint;
    $("#cfgStsUrl").value = c.stsUrl;
    $("#cfgAk").value = c.ak;
    $("#cfgSk").value = c.sk;
    openModal("settingsModal");
  });

  $("#btnSaveCfg").addEventListener("click", () => {
    const newCfg = {
      bucket: $("#cfgBucket").value.trim(),
      endpoint: $("#cfgEndpoint").value.trim(),
      stsUrl: $("#cfgStsUrl").value.trim(),
      ak: $("#cfgAk").value.trim(),
      sk: $("#cfgSk").value.trim()
    };
    const saved = CloudShareConfig.save(newCfg);
    ObsClient.init(saved);
    $("#bucketName").textContent = saved.bucket || "未配置";
    if (ObsClient.isDemo()) setConn("ok"); else setConn("ok");
    closeModal($("#settingsModal"));
    toast("配置已保存" + (ObsClient.isDemo() ? "（演示模式）" : ""), "ok");
    refreshAll();
  });

  $$(".topnav a").forEach(a => a.addEventListener("click", e => {
    $$(".topnav a").forEach(x => x.classList.remove("active"));
    a.classList.add("active");
  }));

  function init() {
    ObsClient.init(cfg);
    $("#bucketName").textContent = cfg.bucket || "未配置";
    if (CloudShareConfig.isConfigured() || true) {
      setConn("ok");
    } else {
      setConn("err");
    }
    refreshAll();
    if (!cfg.bucket) {
      setTimeout(() => toast("演示模式已就绪，点击右上角“配置”可接入真实华为云 OBS", ""), 600);
    }
  }

  init();
})();