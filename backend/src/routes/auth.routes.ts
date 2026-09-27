import { Router } from "express";
import { syncGoogleUser } from "../controllers/auth.controller";

const router = Router();

router.post("/google", syncGoogleUser);

export default router;
