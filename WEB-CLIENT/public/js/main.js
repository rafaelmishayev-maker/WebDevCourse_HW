const Main = (() => {
  function renderUserHeader() {
    const container = document.getElementById("userHeader");
    if (!container) return;

    const user = Auth.getCurrentUserSession?.();
    if (!user) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <img src="${user.imageUrl}" alt="avatar"
             class="rounded-circle"
             style="width:36px;height:36px;object-fit:cover;border:1px solid #ddd;">
        <span class="fw-semibold">${user.username}</span>
      </div>
    `;
  }

  return { renderUserHeader };
})();
