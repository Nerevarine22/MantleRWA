const statusButton = document.getElementById("statusButton");
const statusText = document.getElementById("statusText");

statusButton.addEventListener("click", () => {
  const now = new Date().toLocaleTimeString("uk-UA");
  statusText.textContent = `Сервер активний. Перевірка о ${now}.`;
});
