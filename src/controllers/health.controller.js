// src/controllers/health.controller.js
export const healthCheck = (req, res) => {
  res.json({
    ok: true,
    status: "UP",
    timestamp: new Date()
  });
};
