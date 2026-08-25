// The single axios instance every component should use.
//
// It attaches the session token to each request and reacts to the server
// rejecting one, so an expired session ends at the login screen instead of a
// dashboard full of failed fetches.

import axios from "axios";
import { API_BASE } from "./constants.js";
import { getToken, clearSession, currentRole, loginPathFor } from "./auth.js";

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status;
    // 401: no usable token. 403: wrong role for this route. Either way the
    // stored session cannot do what the page is asking, so drop it.
    if (status === 401 || status === 403) {
      const role = currentRole();
      clearSession();
      const target = loginPathFor(role);
      if (window.location.pathname !== target) window.location.replace(target);
    }
    return Promise.reject(error);
  }
);

/** Message from an API error, falling back to something a person can act on. */
export function apiError(error, fallback = "Something went wrong. Please try again.") {
  if (error?.response?.status === 429) {
    return error.response.data?.error || "Too many attempts. Please wait and try again.";
  }
  return error?.response?.data?.error || fallback;
}

export default api;
