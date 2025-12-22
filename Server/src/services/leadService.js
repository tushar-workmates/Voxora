import Lead from '../models/Lead.js';
import ApiErrorHandle from '../utils/ApiErrorHandle.js';

const createLead = async (leadData) => {
  const lead = new Lead(leadData);
  return await lead.save();
};

const getAllLeads = async (userId) => {
  // Always filter by userId - never return all leads
  return await Lead.find({ userId }).sort({ createdAt: -1 });
};

const deleteLead = async (leadId, userId) => {
  const lead = await Lead.findOneAndDelete({ _id: leadId, userId });
  if (!lead) {
    throw new ApiErrorHandle(404, 'Lead not found or unauthorized');
  }
  return lead;
};

const importLeads = async (leadsData) => {
  let insertedCount = 0;
  const errors = [];

  for (const leadData of leadsData) {
    try {
      // Validate required fields
      if (!leadData.name || !leadData.email || !leadData.phone || !leadData.company) {
        const error = `Skipping lead: Missing required fields - ${JSON.stringify(leadData)}`;
        errors.push(error);
        continue;
      }

      // Map CSV fields to database fields
      const lead = new Lead({
        fullName: leadData.name,
        email: leadData.email,
        phone: leadData.phone,
        company: leadData.company,
        status: 'Pending',
        userId: leadData.userId
      });

      await lead.save();
      insertedCount++;
    } catch (error) {
      const errorMsg = `Failed to import lead ${leadData.name || 'Unknown'}: ${error.message}`;
      errors.push(errorMsg);
    }
  }

  return {
    insertedCount,
    errors,
    success: true
  };
};

const importCsvContent = async (csvContent, userId) => {
  console.log('Parsing CSV content...');
  
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new ApiErrorHandle(400, 'CSV file must contain header and at least one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  console.log('CSV headers:', headers);

  const leadsData = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    
    if (values.length !== headers.length) {
      console.log(`Skipping row ${i}: Column count mismatch`);
      continue;
    }

    const leadData = { userId };
    headers.forEach((header, index) => {
      // Map common CSV headers to expected fields
      const normalizedHeader = header.toLowerCase().replace(/\s+/g, '');
      if (normalizedHeader.includes('name') || normalizedHeader === 'fullname') {
        leadData.name = values[index];
      } else if (normalizedHeader.includes('email')) {
        leadData.email = values[index];
      } else if (normalizedHeader.includes('phone')) {
        leadData.phone = values[index];
      } else if (normalizedHeader.includes('company')) {
        leadData.company = values[index];
      }
    });

    if (leadData.name && leadData.email && leadData.phone && leadData.company) {
      leadsData.push(leadData);
    }
  }

  console.log(`Parsed ${leadsData.length} valid leads from CSV`);
  return await importLeads(leadsData);
};

const updateLeadStatus = async (leadId, status, userId) => {
  const lead = await Lead.findOneAndUpdate(
    { _id: leadId, userId }, 
    { status }, 
    { new: true }
  );
  if (!lead) {
    throw new ApiErrorHandle(404, 'Lead not found or unauthorized');
  }
  return lead;
};

export default {
  createLead,
  getAllLeads,
  deleteLead,
  importLeads,
  importCsvContent,
  updateLeadStatus
};
