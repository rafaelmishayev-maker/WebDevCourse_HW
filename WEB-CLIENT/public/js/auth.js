// auth.js
// Handles register + login logic (LocalStorage based)
// Comments are in English as requested.

document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        registerForm.addEventListener("submit", handleRegisterSubmit);
    }

    // (In the next step we'll add login form handler here too)
});

// ---------- Register ----------

function handleRegisterSubmit(e) {
    e.preventDefault();

    const firstNameEl = document.getElementById("regFirstName");
    const usernameEl = document.getElementById("regUsername");
    const passwordEl = document.getElementById("regPassword");
    const confirmEl = document.getElementById("regConfirm");
    const imageUrlEl = document.getElementById("regImageUrl");
    const msgEl = document.getElementById("registerMsg");

    // Clear message
    setMsg(msgEl, "", "");

    // 1) Required fields validation
    const requiredOk = validateRequired([
        firstNameEl,
        usernameEl,
        passwordEl,
        confirmEl,
        imageUrlEl,
    ]);

    // If required fields fail, stop here
    if (!requiredOk) {
        setMsg(msgEl, "Please fill all required fields.", "text-danger");
        return;
    }

    const firstName = firstNameEl.value.trim();
    const username = usernameEl.value.trim();
    const password = passwordEl.value;
    const confirmPassword = confirmEl.value;
    const imageUrl = imageUrlEl.value.trim();

    // 2) Check username uniqueness in LocalStorage users
    const users = readUsers();
    const usernameExists = users.some(
        (u) => u.username.toLowerCase() === username.toLowerCase()
    );

    if (usernameExists) {
        markInvalid(usernameEl, true);
        setMsg(msgEl, "Username already exists. Please choose another.", "text-danger");
        return;
    } else {
        markInvalid(usernameEl, false);
    }

    // 3) Password rules:
    // - Minimum 6 chars
    // - At least 1 letter
    // - At least 1 number
    // - At least 1 special char (non-alphanumeric)
    const passwordCheck = validatePassword(password);

    if (!passwordCheck.ok) {
        markInvalid(passwordEl, true, passwordCheck.message);
        setMsg(msgEl, passwordCheck.message, "text-danger");
        return;
    } else {
        markInvalid(passwordEl, false);
    }

    // 4) Confirm password matches
    if (password !== confirmPassword) {
        markInvalid(confirmEl, true, "Passwords must match.");
        setMsg(msgEl, "Passwords do not match.", "text-danger");
        return;
    } else {
        markInvalid(confirmEl, false);
    }

    // If everything is valid -> create user
    const newUser = {
        username,
        password,  // Note: For real apps, never store plain passwords. For this course, it's OK.
        firstName,
        imageUrl,
        createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    setMsg(msgEl, "Registration successful! Redirecting to login...", "text-success");

    // Redirect to login after a short delay (nice UX)
    setTimeout(() => {
        window.location.href = "login.html";
    }, 700);
}

// ---------- Helpers ----------

function readUsers() {
    const raw = localStorage.getItem("users");
    return raw ? JSON.parse(raw) : [];
}

function saveUsers(users) {
    localStorage.setItem("users", JSON.stringify(users));
}

function validateRequired(elements) {
    let ok = true;
    elements.forEach((el) => {
        const value = el.value.trim();
        if (!value) {
            markInvalid(el, true);
            ok = false;
        } else {
            markInvalid(el, false);
        }
    });
    return ok;
}

function validatePassword(password) {
    if (password.length < 6) {
        return { ok: false, message: "Password must be at least 6 characters." };
    }

    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasLetter || !hasNumber || !hasSpecial) {
        return {
            ok: false,
            message: "Password must include at least 1 letter, 1 number, and 1 special character.",
        };
    }

    return { ok: true, message: "" };
}

function markInvalid(inputEl, isInvalid, customMsg) {
    if (isInvalid) {
        inputEl.classList.add("is-invalid");
        inputEl.classList.remove("is-valid");

        // Optional: update specific invalid feedback text for password / confirm
        if (customMsg) {
            const passwordInvalidMsg = document.getElementById("passwordInvalidMsg");
            const confirmInvalidMsg = document.getElementById("confirmInvalidMsg");

            if (inputEl.id === "regPassword" && passwordInvalidMsg) {
                passwordInvalidMsg.textContent = customMsg;
            }
            if (inputEl.id === "regConfirm" && confirmInvalidMsg) {
                confirmInvalidMsg.textContent = customMsg;
            }
        }
    } else {
        inputEl.classList.remove("is-invalid");
        inputEl.classList.add("is-valid");
    }
}

function setMsg(el, text, className) {
    if (!el) return;
    el.className = `small mt-2 ${className || ""}`;
    el.textContent = text;
}

// ---------- Login ----------

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLoginSubmit);
    }
});

function handleLoginSubmit(e) {
    e.preventDefault();

    const usernameEl = document.getElementById("loginUsername");
    const passwordEl = document.getElementById("loginPassword");
    const msgEl = document.getElementById("loginMsg");

    clearValidation(usernameEl, passwordEl);
    setMsg(msgEl, "", "");

    const username = usernameEl.value.trim();
    const password = passwordEl.value;

    if (!username || !password) {
        setMsg(msgEl, "Please fill all fields.", "text-danger");
        markInvalid(usernameEl, !username);
        markInvalid(passwordEl, !password);
        return;
    }

    const users = readUsers();

    const user = users.find(
        (u) => u.username === username && u.password === password
    );

    if (!user) {
        setMsg(msgEl, "Invalid username or password.", "text-danger");
        markInvalid(usernameEl, true);
        markInvalid(passwordEl, true);
        return;
    }

    // SUCCESS → save currentUser in SESSION storage
    sessionStorage.setItem(
        "currentUser",
        JSON.stringify({
            username: user.username,
            firstName: user.firstName,
            imageUrl: user.imageUrl,
        })
    );

    setMsg(msgEl, "Login successful! Redirecting...", "text-success");

    setTimeout(() => {
        window.location.href = "search.html";
    }, 500);
}

function clearValidation(...inputs) {
    inputs.forEach((el) => {
        el.classList.remove("is-invalid", "is-valid");
    });
}
