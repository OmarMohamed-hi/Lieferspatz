document.addEventListener("DOMContentLoaded", () => {
  console.log("Website loaded successfully!");
});

document.getElementById("profile-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const firstName = document.getElementById("first-name").value;
  const lastName = document.getElementById("last-name").value;
  const phoneNumber = document.getElementById("phone-number").value;
  const email = document.getElementById("email").value;
  const partnerType = document.querySelector(
    'input[name="partner-type"]:checked'
  ).value;
  const country = document.getElementById("country").value;
  const street = document.getElementById("street").value;
  const zipCode = document.getElementById("zip-code").value;

  alert(`Profile saved for ${firstName} ${lastName} as a ${partnerType}.`);
  console.log({
    firstName,
    lastName,
    phoneNumber,
    email,
    partnerType,
    country,
    street,
    zipCode,
  });
});
