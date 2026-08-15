import express from "express";

import  { createStudentAuthentication } 
from "../controllers/student-authentication-controller.js";

import {authenticateAdmin} from "../middlewares/admin-middleware.js";

import {deleteStudentAuthentication , getAllStudentAuthentications} from 
"../controllers/student-authentication-controller.js";







const router = express.Router();





router.post("/add", authenticateAdmin, createStudentAuthentication );

router.delete("/delete/:id", authenticateAdmin, deleteStudentAuthentication );

router.get("/all", authenticateAdmin, getAllStudentAuthentications );

export default router;