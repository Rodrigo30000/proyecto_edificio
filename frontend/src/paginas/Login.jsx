// src/paginas/Login.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";

export const Login = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [captchaValue, setCaptchaValue] = useState(null);

  const RECAPTCHA_SITE_KEY = "6Leaid8rAAAAACEjazIaGnr6QYac3AjR6BbUNn1X";

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = "Ingresa tu usuario.";
    if (!form.password.trim()) errs.password = "Ingresa tu contraseña.";
    if (!captchaValue) errs.captcha = "Verifica que no eres un robot.";
    return errs;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);
    try {
      // ✅ Enviar datos al backend
      const response = await fetch("http://localhost:3001/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          token: captchaValue, // token de reCAPTCHA
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Error devuelto por el backend
        setErrors({ global: data.message || "No se pudo iniciar sesión." });
        setSubmitting(false);
        return;
      }

      // ************Guarda datos mínimos (si quieres mantener sesión)
      localStorage.setItem(
        "user",
        JSON.stringify({ username: form.username, rol: data.rol })
      );

      // ********Redirigir según el rol
      if (data.rol === "admin") {
        navigate("/dashboardAdmin");
      } else if (data.rol === "residente") {
        navigate("/home");
      } else {
        setErrors({ global: "Rol desconocido. Contacta al administrador." });
      }
    } catch (err) {
      console.error(err);
      setErrors({ global: "Error de conexión con el servidor." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-semibold text-center mb-2">
          Iniciar sesión
        </h1>
        <p className="text-center text-gray-500 mb-6">
          Accede para continuar
        </p>

        {errors.global && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.global}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usuario
            </label>
            <input
              type="text"
              name="username"
              placeholder="Ingresa tu usuario"
              value={form.username}
              onChange={onChange}
              className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 ${
                errors.username
                  ? "border-red-300 focus:ring-red-200"
                  : "border-gray-300 focus:ring-blue-200"
              }`}
            />
            {errors.username && (
              <p className="mt-1 text-xs text-red-600">{errors.username}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Ingresa tu contraseña"
                value={form.password}
                onChange={onChange}
                className={`w-full rounded-xl border px-3 py-2 pr-12 outline-none focus:ring-2 ${
                  errors.password
                    ? "border-red-300 focus:ring-red-200"
                    : "border-gray-300 focus:ring-blue-200"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 px-3 text-sm text-gray-500 hover:text-gray-700"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password}</p>
            )}
          </div>

          {/*reCAPTCHA */}
          <div className="flex justify-center">
            <ReCAPTCHA
              sitekey={RECAPTCHA_SITE_KEY}
              onChange={(value) => setCaptchaValue(value)}
            />
          </div>
          {errors.captcha && (
            <p className="text-center text-xs text-red-600">
              {errors.captcha}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-xl px-4 py-2 font-medium text-white transition ${
              submitting
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {submitting ? "Iniciando sesión…" : "Ingresar"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          ¿Olvidaste tu contraseña?{" "}
          <Link to="/recuperar" className="text-blue-600 hover:underline">
            Recuperar
          </Link>
        </div>
      </div>
    </div>
  );
};
