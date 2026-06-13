export function telHref(phone) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

export function whatsappHref(phone) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}
