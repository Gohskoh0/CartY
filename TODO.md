- [x] Reviewed repo flow hotspots (backend auth/payment + mobile checkout)
- [x] Fixed mobile checkout payload product_id to use UUID `product.id` (not `_id`)
- [x] Hardened login redirect to OTP when `phone_verified` is missing from login response
- [x] Updated Render `render.yaml` env var notes / ensured JWT_SECRET wiring and preserved required keys
- [ ] Verify `backend/server.py` startup block after tampering (CORS + fail-fast secrets)

- [ ] Commit code fixes
- [ ] Run Expo Go install/test on device using dev server (no production publish)
- [ ] After successful device test, deploy backend + update any webhook/callback URLs if needed

