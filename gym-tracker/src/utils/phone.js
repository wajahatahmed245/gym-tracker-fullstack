export function telHref(phone) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

export function whatsappHref(phone, message) {
  const digits = phone.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function buildLeaveMessage(formattedDates) {
  return `Hi! Just letting you know I'll be unavailable on: ${formattedDates.join(", ")}. Please check the GymTrack app for more details.`;
}
