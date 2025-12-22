import ApiErrorHandle from '../utils/ApiErrorHandle.js';

const validateLead = async (request, reply) => {
  const { fullName, email, phone, company } = request.body;

  if (!fullName || !email || !phone || !company) {
    throw new ApiErrorHandle(400, 'All fields are required');
  }
};

export default validateLead;
