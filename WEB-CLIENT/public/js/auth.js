/* auth.js
   Requirements covered:
   - Register with validations and store users in localStorage ("users")
   - Login validation against localStorage users
   - On login success store currentUser in sessionStorage ("currentUser")
   - Redirects: register -> login, login -> search
   - Helpers: requireLogin, logout, getCurrentUserSession, wireLogout
*/

const Auth = (() => {
    const USERS_KEY = "users";              // localStorage
    const CURRENT_USER_KEY = "currentUser"; // sessionStorage

    // ---------- Storage helpers ----------
    function getUsers() {
        try {
            const raw = localStorage.getItem(USERS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function usernameExists(username) {
        const users = getUsers();
        const u = (username || "").trim().toLowerCase();
        return users.some(x => (x.username || "").trim().toLowerCase() === u);
    }

    function setCurrentUserSession(user) {
        sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }

    function getCurrentUserSession() {
        try {
            const raw = sessionStorage.getItem(CURRENT_USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function clearCurrentUserSession() {
        sessionStorage.removeItem(CURRENT_USER_KEY);
    }

    // ---------- Validation ----------
    // Password rules:
    // - min 6 chars
    // - at least 1 letter
    // - at least 1 digit
    // - at least 1 special (non-alphanumeric)
    function validatePassword(pw) {
        if (typeof pw !== "string") return false;
        if (pw.length < 6) return false;
        const hasLetter = /[A-Za-z]/.test(pw);
        const hasDigit = /\d/.test(pw);
        const hasSpecial = /[^A-Za-z0-9]/.test(pw);
        return hasLetter && hasDigit && hasSpecial;
    }

    function isValidUrl(urlStr) {
        try {
            const u = new URL(urlStr);
            return u.protocol === "http:" || u.protocol === "https:";
        } catch {
            return false;
        }
    }

    // ---------- UI helpers (Bootstrap) ----------
    function showAlert(message, type = "danger") {
        const box = document.getElementById("alertBox");
        if (!box) return;
        box.className = `alert alert-${type}`;
        box.textContent = message;
        box.classList.remove("d-none");
    }

    function hideAlert() {
        const box = document.getElementById("alertBox");
        if (!box) return;
        box.classList.add("d-none");
    }

    function setInvalid(inputEl, message) {
        if (!inputEl) return;
        inputEl.classList.add("is-invalid");
        if (message) {
            const feedback = inputEl.parentElement?.querySelector(".invalid-feedback");
            if (feedback) feedback.textContent = message;
        }
    }

    function setValid(inputEl) {
        if (!inputEl) return;
        inputEl.classList.remove("is-invalid");
    }

    // ---------- Register page ----------
    function initRegisterPage() {
        const form = document.getElementById("registerForm");
        if (!form) return;

        const usernameEl = document.getElementById("username");
        const passwordEl = document.getElementById("password");
        const confirmEl = document.getElementById("confirmPassword");
        const firstNameEl = document.getElementById("firstName");
        const imageUrlEl = document.getElementById("imageUrl");

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            hideAlert();

            // reset validation UI
            [usernameEl, passwordEl, confirmEl, firstNameEl, imageUrlEl].forEach(setValid);

            const username = usernameEl.value.trim();
            const password = passwordEl.value;
            const confirmPassword = confirmEl.value;
            const firstName = firstNameEl.value.trim();
            const imageUrl = imageUrlEl.value.trim();

            // 2.1 required fields
            let ok = true;
            if (!username) { setInvalid(usernameEl, "Username is required."); ok = false; }
            if (!password) { setInvalid(passwordEl, "Password is required."); ok = false; }
            if (!confirmPassword) { setInvalid(confirmEl, "Confirm password is required."); ok = false; }
            if (!firstName) { setInvalid(firstNameEl, "First name is required."); ok = false; }
            if (!imageUrl) { setInvalid(imageUrlEl, "Image URL is required."); ok = false; }

            if (!ok) {
                showAlert("Please fill all required fields.", "danger");
                return;
            }

            // URL validity
            if (!isValidUrl(imageUrl)) {
                setInvalid(imageUrlEl, "Please enter a valid URL (http/https).");
                showAlert("Please enter a valid image URL.", "danger");
                return;
            }

            // 2.2 username unique
            if (usernameExists(username)) {
                setInvalid(usernameEl, "Username already exists. Choose another one.");
                showAlert("Username already exists.", "danger");
                return;
            }

            // 2.3 + 2.4 password rules
            if (!validatePassword(password)) {
                setInvalid(
                    passwordEl,
                    "Password must be 6+ chars and include: letter, number, special character."
                );
                showAlert("Password does not meet requirements.", "danger");
                return;
            }

            // 2.5 confirm password match
            if (password !== confirmPassword) {
                setInvalid(confirmEl, "Passwords must match.");
                showAlert("Passwords do not match.", "danger");
                return;
            }

            // 3 save user and redirect to login
            const users = getUsers();
            users.push({
                username,
                password,
                firstName,
                imageUrl
            });
            saveUsers(users);

            showAlert("Registration successful! Redirecting to login...", "success");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 600);
        });
    }

    // ---------- Login page ----------
    function initLoginPage() {
        const form = document.getElementById("loginForm");
        if (!form) return;

        const usernameEl = document.getElementById("username");
        const passwordEl = document.getElementById("password");

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            hideAlert();

            setValid(usernameEl);
            setValid(passwordEl);

            const username = usernameEl.value.trim();
            const password = passwordEl.value;

            let ok = true;
            if (!username) { setInvalid(usernameEl, "Username is required."); ok = false; }
            if (!password) { setInvalid(passwordEl, "Password is required."); ok = false; }

            if (!ok) {
                showAlert("Please fill all required fields.", "danger");
                return;
            }

            // 1) validate against local users
            const users = getUsers();
            const found = users.find(u =>
                (u.username || "").trim().toLowerCase() === username.toLowerCase() &&
                u.password === password
            );

            if (!found) {
                showAlert("Invalid username or password.", "danger");
                return;
            }

            // 2) success -> save currentUser in SESSION + redirect
            setCurrentUserSession({
                username: found.username,
                firstName: found.firstName,
                imageUrl: found.imageUrl
            });

            showAlert("Login successful! Redirecting...", "success");
            setTimeout(() => {
                window.location.href = "search.html";
            }, 400);
        });
    }

    // ---------- Navigation guards / logout ----------
    function requireLogin() {
        const user = getCurrentUserSession();
        if (!user) window.location.href = "login.html";
    }

    function logout() {
        clearCurrentUserSession();
        window.location.href = "login.html";
    }

    function wireLogout(btnId) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener("click", logout);
    }

    // ---------- Public API ----------
    return {
        // storage
        getUsers,
        getCurrentUserSession,

        // pages init
        initRegisterPage,
        initLoginPage,

        // session actions
        requireLogin,
        logout,
        wireLogout
    };
})();
