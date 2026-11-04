import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';

import {SelectedBusinessDocument} from '../types';

const acceptedTypes = [types.pdf, types.xls, types.xlsx];

function documentCategory(name: string, mimeType: string | null): SelectedBusinessDocument['category'] {
  const lowerName = name.toLowerCase();
  const isSheet =
    mimeType?.includes('spreadsheet') ||
    mimeType?.includes('excel') ||
    mimeType?.includes('csv') ||
    /\.(xls|xlsx)$/.test(lowerName);

  return isSheet ? 'Customer sheet' : 'Business document';
}

/**
 * Opens the platform's native document provider on Android/iOS. Android
 * providers can ignore MIME filtering, so we validate hasRequestedType before
 * handing metadata to the UI or later to the Ingestion service.
 */
export async function selectBusinessDocuments(): Promise<SelectedBusinessDocument[]> {
  try {
    const picked = await pick({
      allowMultiSelection: true,
      type: acceptedTypes,
    });

    const invalid = picked.find(file => !file.hasRequestedType);
    if (invalid) {
      throw new Error('Please select only a PDF, XLS, or XLSX file.');
    }

    return picked.map(file => {
      const name = file.name ?? 'Untitled document';
      return {
        id: `device-file-${Date.now()}-${file.uri}`,
        name,
        uri: file.uri,
        mimeType: file.type,
        size: file.size,
        category: documentCategory(name, file.type),
        status: 'Selected locally',
      };
    });
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
      return [];
    }
    throw error;
  }
}

