import leadService from '../services/leadService.js';
import ApiResponseHandle from '../utils/ApiResponseHandle.js';
import ApiErrorHandle from '../utils/ApiErrorHandle.js';

const createLead = async (request, reply) => {
  try {
    const leadData = { ...request.body, userId: request.user.id };
    const lead = await leadService.createLead(leadData);
    const response = new ApiResponseHandle(201, lead, 'Lead created successfully');
    reply.code(201).send(response);
  } catch (error) {
    if (error instanceof ApiErrorHandle) {
      throw error;
    }
    throw new ApiErrorHandle(500, 'Failed to create lead');
  }
};

const getAllLeads = async (request, reply) => {
  try {
    const leads = await leadService.getAllLeads(request.user.id);
    const response = new ApiResponseHandle(200, leads, 'Leads retrieved successfully');
    reply.send(response);
  } catch (error) {
    throw new ApiErrorHandle(500, 'Failed to retrieve leads');
  }
};

const deleteLead = async (request, reply) => {
  try {
    await leadService.deleteLead(request.params.id, request.user.id);
    const response = new ApiResponseHandle(200, null, 'Lead deleted successfully');
    reply.send(response);
  } catch (error) {
    if (error instanceof ApiErrorHandle) {
      throw error;
    }
    throw new ApiErrorHandle(500, 'Failed to delete lead');
  }
};

const importLeads = async (request, reply) => {
  try {
    const { leads } = request.body;
    
    if (!leads || !Array.isArray(leads)) {
      throw new ApiErrorHandle(400, 'Invalid leads data');
    }

    const leadsWithUserId = leads.map(lead => ({ ...lead, userId: request.user.id }));
    const results = await leadService.importLeads(leadsWithUserId);
    
    const response = new ApiResponseHandle(200, results, `Successfully imported ${results.insertedCount} leads`);
    reply.send(response);
  } catch (error) {
    if (error instanceof ApiErrorHandle) {
      throw error;
    }
    throw new ApiErrorHandle(500, 'Failed to import leads');
  }
};

const importCsv = async (request, reply) => {
  try {
    const data = await request.file();
    
    if (!data) {
      throw new ApiErrorHandle(400, 'No file uploaded');
    }

    if (!data.filename.endsWith('.csv')) {
      throw new ApiErrorHandle(400, 'Please upload a CSV file');
    }

    const buffer = await data.toBuffer();
    const csvContent = buffer.toString('utf-8');
    
    const results = await leadService.importCsvContent(csvContent, request.user.id);
    
    const response = new ApiResponseHandle(200, results, `Successfully imported ${results.insertedCount} leads`);
    reply.send(response);
  } catch (error) {
    if (error instanceof ApiErrorHandle) {
      throw error;
    }
    throw new ApiErrorHandle(500, 'Failed to import CSV file');
  }
};

const updateLeadStatus = async (request, reply) => {
  try {
    const lead = await leadService.updateLeadStatus(request.params.id, request.body.status, request.user.id);
    const response = new ApiResponseHandle(200, lead, 'Lead status updated successfully');
    reply.send(response);
  } catch (error) {
    if (error instanceof ApiErrorHandle) {
      throw error;
    }
    throw new ApiErrorHandle(500, 'Failed to update lead status');
  }
};

export {
  createLead,
  getAllLeads,
  deleteLead,
  importLeads,
  importCsv,
  updateLeadStatus
};
