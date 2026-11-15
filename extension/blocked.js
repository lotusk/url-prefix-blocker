const url = new URLSearchParams(location.search).get("url");
document.getElementById("url").textContent = url ?? "";
