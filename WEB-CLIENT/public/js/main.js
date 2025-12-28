document.addEventListener("DOMContentLoaded", () => {
  const authArea = document.getElementById("navAuthArea");
  const currentUser = getCurrentUser();

  if (!authArea) return;

  if (currentUser) {
    authArea.innerHTML = `
      <div class="d-flex align-items-center gap-2 text-white">
        <img src="${currentUser.imageUrl}" 
             alt="User Image"
             width="32" height="32"
             class="rounded-circle border" />
        <span>${currentUser.username}</span>
        <button id="logoutBtn" class="btn btn-outline-light btn-sm">Logout</button>
      </div>
    `;

    document.getElementById("logoutBtn").addEventListener("click", () => {
      sessionStorage.removeItem("currentUser");
      window.location.href = "index.html";
    });

  } else {
    authArea.innerHTML = `
      <a class="btn btn-outline-light btn-sm" href="login.html">Login</a>
      <a class="btn btn-outline-light btn-sm" href="register.html">Register</a>
    `;
  }
});

function getCurrentUser() {
  const raw = sessionStorage.getItem("currentUser");
  return raw ? JSON.parse(raw) : null;
}
