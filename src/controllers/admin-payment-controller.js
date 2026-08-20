import { getAllPaymentsForAdmin } from "../services/payment-service.js";
import { handleAuthError } from "../utils/handle-auth-error.js";

// GET /api/admin/access/payments?regNo=&status=&offset=&limit=
export const getAllPaymentsHandler = async (req, res) => {
  try {
    const result = await getAllPaymentsForAdmin(req.query);
    return res.status(200).json({
      success: true,
      message: result.transactions.length > 0 ? "Payments found" : "No payments yet",
      ...result,
    });
  } catch (error) {
    return handleAuthError(res, error, "getAllPayments");
  }
};
