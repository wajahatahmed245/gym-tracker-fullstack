const TOKEN_KEY = "gymtrack_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    let message = res.statusText || "Request failed";
    if (data && typeof data === "object" && data.detail) {
      message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } else if (typeof data === "string" && data) {
      message = data;
    }
    throw new ApiError(message, res.status);
  }

  return data;
}

export const api = {
  // ---- auth ----
  login: (role, email, password) =>
    request("/auth/login", { method: "POST", auth: false, body: { role, email, password } }),
  signupExerciser: (payload) =>
    request("/auth/signup/exerciser", { method: "POST", auth: false, body: payload }),
  signupTrainer: (payload) =>
    request("/auth/signup/trainer", { method: "POST", auth: false, body: payload }),
  me: () => request("/auth/me"),

  // ---- exerciser ----
  dashboard: () => request("/exerciser/dashboard"),
  updateProfile: (payload) => request("/exerciser/profile", { method: "PATCH", body: payload }),
  listWorkouts: () => request("/exerciser/workouts"),
  exerciserCardioExercises: () => request("/exerciser/cardio-exercises"),
  listCardioSessions: () => request("/exerciser/cardio-sessions"),
  logCardioSession: (payload) => request("/exerciser/cardio-sessions", { method: "POST", body: payload }),
  deleteCardioSession: (id) => request(`/exerciser/cardio-sessions/${id}`, { method: "DELETE" }),
  assignedWorkouts: () => request("/exerciser/assigned-workouts"),
  logAssignedWorkout: (assignedId, payload) =>
    request(`/exerciser/assigned-workouts/${assignedId}/log`, { method: "POST", body: payload }),
  lastWorkoutFor: (assignedId) => request(`/exerciser/assigned-workouts/${assignedId}/last`),
  listTrainers: () => request("/trainers"),
  selectTrainer: (trainerId) =>
    request("/exerciser/trainer", { method: "PATCH", body: { trainer_id: trainerId } }),
  leaveTrainer: (note) => request("/exerciser/trainer", { method: "DELETE", body: { note } }),
  updateWorkout: (workoutId, payload) =>
    request(`/exerciser/workouts/${workoutId}`, { method: "PATCH", body: payload }),
  deleteWorkout: (workoutId) => request(`/exerciser/workouts/${workoutId}`, { method: "DELETE" }),
  trainerUnavailability: () => request("/exerciser/trainer/unavailability"),

  // ---- availability (shared) ----
  myUnavailability: () => request("/me/unavailability"),
  addUnavailableDate: (date) => request("/me/unavailability", { method: "POST", body: { date } }),
  removeUnavailableDate: (date) => request(`/me/unavailability/${date}`, { method: "DELETE" }),

  // ---- trainer ----
  trainerExercises: (bodyPart) =>
    request(`/trainer/exercises${bodyPart ? `?body_part=${bodyPart}` : ""}`),
  trainerCardioExercises: () => request("/trainer/cardio-exercises"),
  createCardioExercise: (payload) => request("/trainer/cardio-exercises", { method: "POST", body: payload }),
  deleteCardioExercise: (id) => request(`/trainer/cardio-exercises/${id}`, { method: "DELETE" }),
  clients: () => request("/trainer/clients"),
  clientsUnavailability: () => request("/trainer/clients/unavailability"),
  clientDetail: (id) => request(`/trainer/clients/${id}`),
  assignWorkout: (id, payload) =>
    request(`/trainer/clients/${id}/assign-workout`, { method: "POST", body: payload }),
  updateAssignedWorkout: (exerciserId, assignedId, payload) =>
    request(`/trainer/clients/${exerciserId}/assigned-workouts/${assignedId}`, {
      method: "PATCH",
      body: payload,
    }),
  deleteAssignedWorkout: (exerciserId, assignedId) =>
    request(`/trainer/clients/${exerciserId}/assigned-workouts/${assignedId}`, { method: "DELETE" }),
  removeClient: (exerciserId, note) =>
    request(`/trainer/clients/${exerciserId}`, { method: "DELETE", body: { note } }),
  trainerNotes: () => request("/trainer/notes"),

  // ---- admin ----
  adminDashboard: () => request("/admin/dashboard"),
  adminUsers: () => request("/admin/users"),
  setUserStatus: (id, status) =>
    request(`/admin/users/${id}/status`, { method: "PATCH", body: { status } }),
  resetUserPassword: (id, newPassword) =>
    request(`/admin/users/${id}/password`, { method: "PATCH", body: { new_password: newPassword } }),
  updateUserPhone: (id, phone) =>
    request(`/admin/users/${id}/phone`, { method: "PATCH", body: { phone } }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),

  adminTrainers: () => request("/admin/trainers"),
  approveTrainer: (id) => request(`/admin/trainers/${id}/approve`, { method: "PATCH" }),
  setTrainerStatus: (id, status) =>
    request(`/admin/trainers/${id}/status`, { method: "PATCH", body: { status } }),
  resetTrainerPassword: (id, newPassword) =>
    request(`/admin/trainers/${id}/password`, { method: "PATCH", body: { new_password: newPassword } }),
  updateTrainerPhone: (id, phone) =>
    request(`/admin/trainers/${id}/phone`, { method: "PATCH", body: { phone } }),
  deleteTrainer: (id) => request(`/admin/trainers/${id}`, { method: "DELETE" }),
};
