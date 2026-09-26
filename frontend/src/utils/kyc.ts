import type { KYCStatus, Professional } from '@/types';

export const KYC_STATUS_LABEL: Record<KYCStatus, string> = {
  not_submitted: 'Not Submitted',
  pending: 'Under Review',
  approved: 'Verified',
  rejected: 'Rejected',
};

export const KYC_DOC_LABEL: Record<string, string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN Card',
  voter: 'Voter ID',
  driving: 'Driving Licence',
};

export const kycStatus = (p?: Pick<Professional, 'kyc_status'> | null): KYCStatus =>
  p?.kyc_status || 'not_submitted';

export const isVerified = (p?: Pick<Professional, 'kyc_status'> | null): boolean =>
  p?.kyc_status === 'approved';

export const isKycPending = (p?: Pick<Professional, 'kyc_status'> | null): boolean =>
  p?.kyc_status === 'pending' || p?.kyc_status === 'not_submitted';

export const kycDocLabel = (p?: Pick<Professional, 'kyc_doc_type'> | null): string =>
  (p?.kyc_doc_type && KYC_DOC_LABEL[p.kyc_doc_type]) || p?.kyc_doc_type || 'Document';