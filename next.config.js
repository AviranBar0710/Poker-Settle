/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow ngrok tunnels for mobile/dev access (fixes "Load failed" TypeError on Safari)
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok.io", "*.ngrok.app"],
}

module.exports = nextConfig

