// ESC/POS Bluetooth Thermal Receipt Generator & Web Bluetooth Driver
// Designed for standard 58mm (32 characters per line) and 80mm (48 chars) portable printers

// Format two columns into exact character width (e.g., 32 characters for 58mm)
function formatRow(left, right, width = 32) {
  const leftStr = String(left || '');
  const rightStr = String(right || '');
  const spaces = width - leftStr.length - rightStr.length;
  if (spaces <= 0) {
    return leftStr + ' ' + rightStr + '\n';
  }
  return leftStr + ' '.repeat(spaces) + rightStr + '\n';
}

function divider(char = '-', width = 32) {
  return char.repeat(width) + '\n';
}

function centerText(text, width = 32) {
  const str = String(text || '');
  if (str.length >= width) return str + '\n';
  const leftPadding = Math.floor((width - str.length) / 2);
  return ' '.repeat(leftPadding) + str + '\n';
}

export function generateTextReceipt(receipt, width = 32) {
  const dateFormatted = new Date(receipt.created_at || Date.now()).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const pCountFromReceipt = parseInt(receipt.penalty_count, 10);
  const pCountFromNotes = receipt.loan_notes ? (receipt.loan_notes.match(/\[Penalty/g) || []).length : 0;
  const penaltyCount = !isNaN(pCountFromReceipt) && pCountFromReceipt > 0
    ? pCountFromReceipt
    : (pCountFromNotes > 0 ? pCountFromNotes : (receipt.penalty_applied ? 1 : 0));
  const hasPenalty = Boolean(penaltyCount > 0 || receipt.penalty_applied || (receipt.current_installment_no > 58));

  let lines = [];
  lines.push(centerText('SADHAN APEX (PVT) LTD', width));
  lines.push(centerText('MICRO FINANCIAL SERVICES', width));
  lines.push(centerText('TEL: +94 76 108 3006', width));
  lines.push(centerText('OFFICIAL REPAYMENT RECEIPT', width));
  lines.push(divider('-', width));

  lines.push(formatRow('RECEIPT NO:', receipt.receipt_no, width));
  lines.push(formatRow('DATE/TIME:', dateFormatted, width));
  lines.push(formatRow('COLLECTOR:', receipt.collector_name || 'Staff', width));
  lines.push(divider('-', width));

  lines.push(formatRow('CLIENT:', receipt.client_name, width));
  if (receipt.client_phone) {
    lines.push(formatRow('CONTACT:', receipt.client_phone, width));
  }
  lines.push(formatRow('LOAN REF:', receipt.loan_code, width));
  lines.push(formatRow('PLAN:', hasPenalty ? `Extended (+${penaltyCount * 8}%)` : '54-Days (58-Lim)', width));
  lines.push(formatRow('INSTALLMENT:', `#${receipt.current_installment_no || 1} of ${receipt.installment_count || 58}`, width));
  lines.push(formatRow('PAYMENT TYPE:', receipt.payment_type === 'PARTIAL' ? '*PARTIAL*' : 'FULL', width));
  lines.push(formatRow('METHOD:', receipt.payment_method || 'CASH', width));
  lines.push(divider('=', width));

  lines.push(centerText('AMOUNT RECEIVED', width));
  lines.push(centerText(`Rs. ${Math.round(Number(receipt.amount_paid)).toLocaleString()}`, width));
  lines.push(divider('=', width));

  lines.push(formatRow('PREV BALANCE:', `Rs. ${Math.round(Number(receipt.previous_balance)).toLocaleString()}`, width));
  lines.push(formatRow('REMAINING BAL:', `Rs. ${Math.round(Number(receipt.remaining_balance)).toLocaleString()}`, width));

  if (hasPenalty && receipt.total_penalties > 0) {
    lines.push(formatRow('INCL. PENALTY:', `+Rs. ${Math.round(Number(receipt.total_penalties)).toLocaleString()}`, width));
  }

  if (receipt.next_due_date && receipt.next_due_date !== 'Completed') {
    lines.push(divider('-', width));
    const nextDateStr = String(receipt.next_due_date).split('T')[0];
    lines.push(formatRow('NEXT DUE DATE:', nextDateStr, width));
    if (receipt.next_due_amount > 0) {
      lines.push(formatRow('NEXT DUE AMT:', `Rs. ${Math.round(Number(receipt.next_due_amount)).toLocaleString()}`, width));
    }
  }

  lines.push(divider('-', width));
  lines.push(centerText('Thank you for your payment!', width));
  lines.push(centerText('Keep this receipt for records.', width));
  lines.push(centerText('Nexora Software Solutions', width));

  return lines.join('');
}

// Convert string to ESC/POS binary buffer
export function generateEscPos(receipt, width = 32) {
  const encoder = new TextEncoder();
  const buffer = [];

  const write = (bytes) => {
    for (let i = 0; i < bytes.length; i++) buffer.push(bytes[i]);
  };

  const writeText = (str) => {
    const encoded = encoder.encode(str);
    for (let i = 0; i < encoded.length; i++) buffer.push(encoded[i]);
  };

  // ESC @: Initialize printer
  write([0x1B, 0x40]);

  // Center alignment
  write([0x1B, 0x61, 0x01]);

  // Double height & bold for company name
  write([0x1B, 0x45, 0x01]); // Bold ON
  write([0x1D, 0x21, 0x01]); // Double height
  writeText('SADHAN APEX (PVT) LTD\n');
  write([0x1D, 0x21, 0x00]); // Normal size
  write([0x1B, 0x45, 0x00]); // Bold OFF

  writeText('MICRO FINANCIAL SERVICES\n');
  writeText('TEL: +94 76 108 3006\n');
  writeText('OFFICIAL REPAYMENT RECEIPT\n');

  // Left alignment
  write([0x1B, 0x61, 0x00]);
  writeText(divider('-', width));

  const dateFormatted = new Date(receipt.created_at || Date.now()).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  writeText(formatRow('RECEIPT NO:', receipt.receipt_no, width));
  writeText(formatRow('DATE/TIME:', dateFormatted, width));
  writeText(formatRow('COLLECTOR:', receipt.collector_name || 'Staff', width));
  writeText(divider('-', width));

  writeText(formatRow('CLIENT:', receipt.client_name, width));
  if (receipt.client_phone) {
    writeText(formatRow('CONTACT:', receipt.client_phone, width));
  }
  writeText(formatRow('LOAN REF:', receipt.loan_code, width));
  writeText(formatRow('INSTALLMENT:', `#${receipt.current_installment_no || 1} of ${receipt.installment_count || 58}`, width));
  writeText(formatRow('PAYMENT TYPE:', receipt.payment_type === 'PARTIAL' ? '*PARTIAL*' : 'FULL', width));
  writeText(formatRow('METHOD:', receipt.payment_method || 'CASH', width));
  writeText(divider('=', width));

  // Prominent Amount Box
  write([0x1B, 0x61, 0x01]); // Center align
  writeText('AMOUNT RECEIVED\n');
  write([0x1B, 0x45, 0x01]); // Bold ON
  write([0x1D, 0x21, 0x11]); // Double height + Double width
  writeText(`Rs. ${Math.round(Number(receipt.amount_paid)).toLocaleString()}\n`);
  write([0x1D, 0x21, 0x00]); // Normal size
  write([0x1B, 0x45, 0x00]); // Bold OFF

  write([0x1B, 0x61, 0x00]); // Left align
  writeText(divider('=', width));

  writeText(formatRow('PREV BALANCE:', `Rs. ${Math.round(Number(receipt.previous_balance)).toLocaleString()}`, width));
  write([0x1B, 0x45, 0x01]); // Bold ON
  writeText(formatRow('REMAINING BAL:', `Rs. ${Math.round(Number(receipt.remaining_balance)).toLocaleString()}`, width));
  write([0x1B, 0x45, 0x00]); // Bold OFF

  if (receipt.next_due_date && receipt.next_due_date !== 'Completed') {
    writeText(divider('-', width));
    const nextDateStr = String(receipt.next_due_date).split('T')[0];
    writeText(formatRow('NEXT DUE DATE:', nextDateStr, width));
    if (receipt.next_due_amount > 0) {
      writeText(formatRow('NEXT DUE AMT:', `Rs. ${Math.round(Number(receipt.next_due_amount)).toLocaleString()}`, width));
    }
  }

  writeText(divider('-', width));
  write([0x1B, 0x61, 0x01]); // Center
  writeText('Thank you for your payment!\n');
  writeText('Keep this receipt for records.\n');
  writeText('Nexora Software Solutions\n');

  // Feed 4 lines and partial cut
  writeText('\n\n\n\n');
  write([0x1D, 0x56, 0x00]); // ESC/POS paper cut

  return new Uint8Array(buffer);
}

// Direct Web Bluetooth Printing (Zero 3rd party app required on supported devices)
export async function printDirectWebBluetooth(receipt, width = 32) {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome on Android/PC or use the App Print button.');
  }

  // Request Bluetooth Thermal Printer
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS printer service
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent
      '0000ff00-0000-1000-8000-00805f9b34fb',
      '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / generic BLE POS
      '0000fee7-0000-1000-8000-00805f9b34fb'
    ]
  });

  if (!device.gatt) {
    throw new Error('Bluetooth device does not support GATT.');
  }

  const server = await device.gatt.connect();

  // Find printer service
  const services = await server.getPrimaryServices();
  let writeChar = null;

  for (const service of services) {
    try {
      const chars = await service.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties.write || ch.properties.writeWithoutResponse) {
          writeChar = ch;
          break;
        }
      }
      if (writeChar) break;
    } catch (e) {
      // Continue searching other services
    }
  }

  if (!writeChar) {
    server.disconnect();
    throw new Error('Could not find a writable Bluetooth printer channel on this device.');
  }

  const escPosData = generateEscPos(receipt, width);

  // Send data in chunks of 512 bytes (standard BLE MTU)
  const chunkSize = 256;
  for (let i = 0; i < escPosData.length; i += chunkSize) {
    const chunk = escPosData.slice(i, i + chunkSize);
    if (writeChar.properties.writeWithoutResponse) {
      await writeChar.writeValueWithoutResponse(chunk);
    } else {
      await writeChar.writeValue(chunk);
    }
    // Small pause to allow printer buffer to keep up
    await new Promise(r => setTimeout(r, 40));
  }

  setTimeout(() => {
    try { server.disconnect(); } catch (e) {}
  }, 1000);

  return true;
}
