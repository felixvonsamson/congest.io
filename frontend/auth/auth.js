function getToken() {
  return sessionStorage.getItem("access_token");
}

export function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getToken()}`
  };
}

export async function ensureLoggedIn() {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    showAuth();
    return false;
  }

  const res = await fetch("/api/me", {
    headers: authHeaders()
  });

  if (!res.ok) {
    showAuth();
    return false;
  }

  const player = await res.json();
  sessionStorage.setItem("player", JSON.stringify(player));
  document.getElementById("moneyAmount").textContent = `${player.money}€`;
  const auth_button = document.getElementById("authButton");
  auth_button.textContent = "Logout";
  auth_button.onclick = logout;
  return true;
}

function logout() {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("player");
  location.reload();
}

export async function handleAuth(endpoint) {
  let username, password, confirm;
  const errorEl = document.getElementById("authError");
  if (endpoint === "register") {
    password = document.getElementById("signupPassword").value;
    confirm = document.getElementById("signupConfirmPassword").value;
    if (password !== confirm) {
      errorEl.textContent = "Passwords do not match";
      return;
    }
    username = document.getElementById("signupUsername").value;
  }else {
    username = document.getElementById("loginUsername").value;
    password = document.getElementById("loginPassword").value;
  }

  errorEl.textContent = "";

  try {
    const res = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      errorEl.textContent = "Invalid credentials";
      return;
    }

    const data = await res.json();
    sessionStorage.setItem("access_token", data.access_token);
    sessionStorage.setItem("player", JSON.stringify(data.player));

    hideAuth();
    location.reload(); // simplest + safest
  } catch (e) {
    errorEl.textContent = "Server error: " + e.message;
  }
}

document.getElementById("loginBtn").onclick = () => handleAuth("login");
document.getElementById("signupBtn").onclick = () => handleAuth("register");

function showAuth() {
  document.getElementById("authPanel").style.display = "flex";
}

function hideAuth() {
  document.getElementById("authPanel").style.display = "none";
}