import express from 'express';
import { authenticate } from "../middlewares/auth-middleware.js";
import { getSmartSearchResults } from "../controllers/student-rag-controller.js";

const router = express.Router();

router.use(authenticate);

// Define your student RAG access routes here

router.post("/access", getSmartSearchResults);



export default router;