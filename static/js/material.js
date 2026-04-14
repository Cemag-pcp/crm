(() => {
  const PAGE_KEY = "material";
  const FOLDER_MIME = "application/vnd.google-apps.folder";
  const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
  const MIME_ICONS = {
    "application/vnd.google-apps.folder": "📁",
    "application/vnd.google-apps.shortcut": "📁",
    "application/vnd.google-apps.document": "📝",
    "application/vnd.google-apps.spreadsheet": "📊",
    "application/vnd.google-apps.presentation": "📽️",
    "application/pdf": "📄",
    "image/jpeg": "🖼️",
    "image/png": "🖼️",
    "video/mp4": "🎬",
  };

  function iconFor(file) {
    if (file.mimeType === SHORTCUT_MIME && file.shortcutDetails) {
      return MIME_ICONS[file.shortcutDetails.targetMimeType] || "📎";
    }
    return MIME_ICONS[file.mimeType] || "📎";
  }

  function effectiveMime(file) {
    if (file.mimeType === SHORTCUT_MIME && file.shortcutDetails) {
      return file.shortcutDetails.targetMimeType;
    }
    return file.mimeType;
  }

  function effectiveId(file) {
    if (file.mimeType === SHORTCUT_MIME && file.shortcutDetails) {
      return file.shortcutDetails.targetId;
    }
    return file.id;
  }

  function formatSize(bytes) {
    if (!bytes) return "";
    const n = Number.parseInt(bytes, 10);
    if (Number.isNaN(n)) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("pt-BR");
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function createPageState(rootFolderId) {
    return {
      cache: new Map(),
      stack: [{ id: rootFolderId, name: "Início" }],
    };
  }

  function renderBreadcrumb(root, state, loadFolder) {
    const breadcrumb = root.querySelector("#breadcrumb");
    if (!breadcrumb) return;

    breadcrumb.innerHTML = "";
    state.stack.forEach((item, index) => {
      const li = document.createElement("li");
      const isLast = index === state.stack.length - 1;
      li.className = `breadcrumb-item${isLast ? " active" : ""}`;

      if (isLast) {
        li.textContent = item.name;
      } else {
        const link = document.createElement("a");
        link.href = "#";
        link.className = "text-decoration-none";
        link.textContent = item.name;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          state.stack.splice(index + 1);
          loadFolder(item.id);
        });
        li.appendChild(link);
      }

      breadcrumb.appendChild(li);
    });
  }

  function renderFiles(root, state, files, loadFolder) {
    const container = root.querySelector("#drive-container");
    if (!container) return;

    if (!files.length) {
      container.innerHTML = '<p class="text-muted">Esta pasta está vazia.</p>';
      return;
    }

    const table = document.createElement("table");
    table.className = "table table-hover align-middle";
    table.innerHTML = `
      <thead class="table-dark">
        <tr>
          <th>Nome</th>
          <th class="d-none d-md-table-cell">Modificado</th>
          <th class="d-none d-md-table-cell">Tamanho</th>
          <th></th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement("tbody");

    files.forEach((file) => {
      const mime = effectiveMime(file);
      const navId = effectiveId(file);
      const isFolder = mime === FOLDER_MIME;
      const tr = document.createElement("tr");
      tr.style.cursor = isFolder ? "pointer" : "default";

      const nameTd = document.createElement("td");
      nameTd.innerHTML = `<span style="font-size:1.2em;margin-right:.5em;">${iconFor(file)}</span>${escapeHtml(file.name)}`;
      tr.appendChild(nameTd);

      const dateTd = document.createElement("td");
      dateTd.className = "d-none d-md-table-cell text-muted small";
      dateTd.textContent = formatDate(file.modifiedTime);
      tr.appendChild(dateTd);

      const sizeTd = document.createElement("td");
      sizeTd.className = "d-none d-md-table-cell text-muted small";
      sizeTd.textContent = isFolder ? "" : formatSize(file.size);
      tr.appendChild(sizeTd);

      const actionTd = document.createElement("td");
      actionTd.className = "text-end";
      if (!isFolder && file.webViewLink) {
        const btn = document.createElement("a");
        btn.href = file.webViewLink;
        btn.target = "_blank";
        btn.rel = "noopener noreferrer";
        btn.className = "btn btn-sm btn-outline-secondary";
        btn.textContent = "Abrir";
        actionTd.appendChild(btn);
      }
      tr.appendChild(actionTd);

      if (isFolder) {
        tr.addEventListener("click", () => {
          state.stack.push({ id: navId, name: file.name });
          loadFolder(navId);
        });
      }

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.innerHTML = "";
    container.appendChild(table);
  }

  function setLoading(root) {
    const container = root.querySelector("#drive-container");
    if (!container) return;

    container.innerHTML =
      '<div class="d-flex justify-content-center py-5"><div class="spinner-border text-secondary" role="status"><span class="visually-hidden">Carregando...</span></div></div>';
  }

  function setError(root, message) {
    const container = root.querySelector("#drive-container");
    if (!container) return;
    container.innerHTML = `<div class="alert alert-danger">${escapeHtml(message)}</div>`;
  }

  function initMaterialPage(root) {
    if (!root || root.dataset.page !== PAGE_KEY || root.dataset.materialInitialized === "true") {
      return;
    }

    const rootFolderId = root.dataset.rootFolderId;
    if (!rootFolderId) {
      setError(root, "Pasta raiz do Google Drive não configurada.");
      return;
    }

    root.dataset.materialInitialized = "true";
    const state = createPageState(rootFolderId);

    function loadFolder(folderId) {
      renderBreadcrumb(root, state, loadFolder);

      if (state.cache.has(folderId)) {
        renderFiles(root, state, state.cache.get(folderId), loadFolder);
        return;
      }

      setLoading(root);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);

      fetch(`/api/drive/files/?folder_id=${encodeURIComponent(folderId)}`, { signal: controller.signal })
        .then((response) =>
          response
            .json()
            .catch(() => ({}))
            .then((data) => ({ ok: response.ok, status: response.status, data }))
        )
        .then(({ ok, status, data }) => {
          window.clearTimeout(timeoutId);

          if (!ok || data.detail) {
            const detail = data.detail || `Erro ${status} ao carregar arquivos.`;
            setError(root, detail);
            return;
          }

          const files = Array.isArray(data.files) ? data.files : [];
          state.cache.set(folderId, files);
          renderFiles(root, state, files, loadFolder);
        })
        .catch((error) => {
          window.clearTimeout(timeoutId);
          const message =
            error && error.name === "AbortError"
              ? "Tempo limite excedido ao carregar arquivos do Google Drive."
              : "Erro ao carregar arquivos.";
          setError(root, message);
          console.error("Falha ao carregar material:", error);
        });
    }

    renderBreadcrumb(root, state, loadFolder);
    loadFolder(rootFolderId);
  }

  function initAllMaterialPages() {
    document.querySelectorAll('[data-page="material"]').forEach((root) => {
      initMaterialPage(root);
    });
  }

  document.addEventListener("DOMContentLoaded", initAllMaterialPages);
  document.body.addEventListener("htmx:afterSwap", (event) => {
    if (event.target && event.target.id === "app-main") {
      initAllMaterialPages();
    }
  });
})();
