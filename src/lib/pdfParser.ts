import pdfParse from 'pdf-parse';

export type ParsedTransaction = {
    rawLine: string;
    date: string; // ISO format: YYYY-MM-DD
    description: string;
    amount: number; // positive for inflow, negative for outflow
};

/**
 * Normalizes whitespace in text
 * Handles non-breaking spaces and collapses all whitespace
 */
function normalizeWhitespace(text: string): string {
    return text
        .replace(/\u00A0/g, ' ')   // non-breaking spaces
        .replace(/\s+/g, ' ')      // collapse all whitespace
        .trim();
}

/**
 * Extracts the statement year from "Statement Period" line
 * Example: "Statement Period 07/24/25 - 08/23/25" → 2025
 */
function extractStatementYear(text: string): number | null {
    const patterns = [
        /Statement Period[:\s]+(\d{2})\/(\d{2})\/(\d{2})/i,
        /Statement Period[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{2})/i,
    ];

    for (const pattern of patterns) {
        const periodMatch = text.match(pattern);
        if (periodMatch) {
            const yearStr = periodMatch[3]; // Last two digits
            const year = 2000 + parseInt(yearStr, 10);
            if (year >= 2000 && year <= 2099) {
                return year;
            }
        }
    }

    // Fallback: try to find any date pattern with 2-digit year
    const fallbackMatch = text.match(/\d{2}\/\d{2}\/(\d{2})/);
    if (fallbackMatch) {
        const yearStr = fallbackMatch[3]; // Third capture group (year is last)
        const year = 2000 + parseInt(yearStr, 10);
        if (year >= 2000 && year <= 2099) {
            return year;
        }
    }

    // Last resort: use current year
    return new Date().getFullYear();
}

/**
 * Parses amount string with correct sign handling
 * Handles trailing minus: "117.55-" → -117.55
 */
function parseAmount(s: string): number | null {
    const trimmed = s.replace(/,/g, '').trim();
    if (!trimmed) return null;

    const isNegative = trimmed.endsWith('-') && !trimmed.startsWith('-');
    const numericStr = trimmed.replace(/^-/, '').replace(/-$/, '');
    const numeric = parseFloat(numericStr);

    if (Number.isNaN(numeric)) return null;

    return isNegative ? -numeric : numeric;
}

/**
 * Extracts meaningful description from transaction detail
 */
function extractDescription(detail: string): string {
    let description = detail;
    
    // For POS transactions: "POS Debit- Debit Card 3874 07-25-25 Amazon..." → "Amazon..."
    const posMatch = description.match(/POS\s+Debit-?\s+Debit\s+Card\s+\d+\s+\d{2}-\d{2}-\d{2}\s+(.+)/i);
    if (posMatch && posMatch[1]) {
        description = posMatch[1].trim();
    } else {
        // Look for date pattern (MM-DD-YY) and extract everything after it
        const dateInDetailMatch = description.match(/\d{2}-\d{2}-\d{2}\s+(.+)/);
        if (dateInDetailMatch && dateInDetailMatch[1]) {
            description = dateInDetailMatch[1].trim();
        } else {
            // Remove common prefixes
            description = description
                .replace(/^Deposit\s+-\s+ACH\s+/i, '')
                .replace(/^Paid\s+To\s+/i, '')
                .replace(/^Transfer\s+(To|From)\s+/i, '')
                .replace(/^Zelle\s+DB\s+/i, '')
                .trim();
        }
    }

    // Final cleanup
    description = description
        .replace(/\d{2}-\d{2}-\d{2}\s*/g, '') // Remove any remaining date patterns
        .replace(/^(POS|ACH|Debit|Card|Deposit)\s+/i, '') // Remove transaction type words
        .trim();

    if (description.length < 2) {
        description = detail; // Fallback to original
    }

    return description;
}

/**
 * Extracts transactions from a PDF bank statement
 * Navy Federal statements have detail lines BEFORE the header, amounts AFTER the header
 * 
 * @param pdfBuffer - Buffer containing the PDF file
 * @returns Array of parsed transactions
 */
export async function parsePdfTransactions(
    pdfBuffer: Buffer
): Promise<ParsedTransaction[]> {
    try {
        // Extract text from PDF
        const data = await pdfParse(pdfBuffer);
        const text = data.text;

        if (!text || text.trim().length === 0) {
            throw new Error('PDF appears to be empty or contains no extractable text.');
        }

        // Extract statement year
        const statementYear = extractStatementYear(text);
        const year = statementYear || new Date().getFullYear();
        console.log(`PDF Parser: Extracted year: ${year} (statementYear: ${statementYear})`);

        // Split into lines
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        console.log(`PDF Parser: Total lines extracted: ${lines.length}`);
        console.log(`PDF Parser: First 10 lines:`, lines.slice(0, 10));

        // Regex patterns
        const transactionHeaderRegex = /Date\s+Transaction\s+Detail\s+Amount\(\$?\)\s+Balance\(\$?\)/i;
        const itemsPaidHeaderRegex = /^Date\s+Item\s+Amount\(\$?\)/i;
        
        // Detail line pattern: MM-DD description (before header)
        const detailLineRegex = /^(\d{2}-\d{2})\s+(.+)$/;
        
        // Amount pattern: amount balance (from numeric section after header)
        // May have trailing "-" after balance to indicate negative amount
        const amountPattern = /(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?-?)\s+(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?-?)\s*-?$/;

        // Find the header index - try multiple strategies
        let headerIndex = -1;
        let itemsPaidIndex = lines.length;
        
        // Strategy 1: Look for header in single line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const normalized = normalizeWhitespace(line);
            
            // Exact regex match
            if (headerIndex === -1 && transactionHeaderRegex.test(normalized)) {
                headerIndex = i;
                console.log(`PDF Parser: Found header at line ${i} (exact match): "${line}"`);
            }
            
            // Flexible keyword match
            if (headerIndex === -1) {
                const lower = normalized.toLowerCase();
                if (
                    lower.includes('date') &&
                    lower.includes('transaction') &&
                    lower.includes('detail') &&
                    lower.includes('amount') &&
                    lower.includes('balance')
                ) {
                    headerIndex = i;
                    console.log(`PDF Parser: Found header at line ${i} (keyword match): "${line}"`);
                }
            }
            
            // Find Items Paid section start
            if (itemsPaidHeaderRegex.test(normalized)) {
                itemsPaidIndex = i;
            }
        }

        // Strategy 2: If header not found, try looking across multiple lines
        if (headerIndex === -1) {
            console.log('PDF Parser: Header not found in single lines, trying multi-line search...');
            for (let i = 0; i < Math.min(lines.length - 2, 100); i++) {
                // Combine current line with next 2 lines
                const combined = normalizeWhitespace(lines.slice(i, i + 3).join(' '));
                if (transactionHeaderRegex.test(combined)) {
                    headerIndex = i;
                    console.log(`PDF Parser: Found header across lines ${i}-${i+2} (multi-line match)`);
                    break;
                }
                
                const lower = combined.toLowerCase();
                if (
                    lower.includes('date') &&
                    lower.includes('transaction') &&
                    lower.includes('detail') &&
                    lower.includes('amount') &&
                    lower.includes('balance')
                ) {
                    headerIndex = i;
                    console.log(`PDF Parser: Found header across lines ${i}-${i+2} (multi-line keyword match)`);
                    break;
                }
            }
        }

        // If header not found, try to parse anyway by looking for transaction patterns
        if (headerIndex === -1) {
            console.log('PDF Parser: Header not found, attempting lenient parsing...');
            // Look for lines that look like transaction rows (MM-DD followed by description and amount)
            // This handles cases where the header format is different or missing
            for (let i = 0; i < Math.min(lines.length, 200); i++) {
                const line = lines[i];
                // Check if line starts with MM-DD pattern and has amount-like patterns
                if (/^\d{2}-\d{2}\s+/.test(line) && /\d{1,3}(?:,\d{3})*\.\d{2}/.test(line)) {
                    headerIndex = i - 1; // Start parsing from this point (or before if we find a better marker)
                    console.log(`PDF Parser: Found transaction-like line at ${i}, starting parse from line 0`);
                    break;
                }
            }
            if (headerIndex === -1) {
                headerIndex = 0; // Start from beginning as fallback
            }
        }

        console.log(`PDF Parser: Found header at line ${headerIndex}, Items Paid at line ${itemsPaidIndex}`);
        console.log(`PDF Parser: Header line content: "${lines[headerIndex]}"`);

        // Initialize transactions array
        const transactions: ParsedTransaction[] = [];
        
        // Initialize detailLines and amounts arrays (for fallback separated format, though Navy Federal uses full rows)
        const detailLines: Array<{ date: string; detail: string; rawLine: string }> = [];
        const amounts: Array<number> = [];

        // Navy Federal format: Transactions come AFTER the header in full-row format
        // Format: "07-25 Description | 117.55- | 3,300.62" or "07-25 Description 117.55- 3,300.62"
        // We'll parse full rows directly, not separate detail/amount sections

        // Step 2: Parse full-row transactions (date, description, amount, balance all on one line)
        // Navy Federal format: "07-25 POS Debit- Debit Card 3874 07-25-25 Amazon... | 117.55- | 3,300.62"
        // The separator between description and amount might be a pipe (|) or just whitespace
        // Amount has trailing minus for debits: "117.55-"
        // Pattern: MM-DD description amount balance
        const fullRowRegex = /^(\d{2}-\d{2})\s+(.+?)\s+(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?-?)\s+(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?-?)$/;
        
        // More lenient: handle pipe separators and flexible spacing
        // Navy Federal format: "07-25 Description | 117.55- | 3,300.62"
        // Also handle without pipes: "07-25 Description 117.55- 3,300.62"
        const fullRowWithPipeRegex = /^(\d{2}-\d{2})\s+(.+?)\s*\|\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?-?)\s*\|\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?-?)$/;
        
        // Pattern for rows with description, then amount (with trailing minus), then balance
        // This is more flexible - doesn't require exact spacing
        const flexibleRowRegex = /^(\d{2}-\d{2})\s+(.+?)\s+(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})-\s+)?(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)$/;
        
        // Also try a more lenient pattern that doesn't require balance
        const lenientRowRegex = /^(\d{2}-\d{2})\s+(.+?)\s+(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?-?)\s*$/;
        
        // Parse transactions - scan ALL lines, not just after header
        // Transactions might be on pages 2-3, so we need to scan the entire document
        console.log(`PDF Parser: Scanning all ${lines.length} lines for transactions (header at ${headerIndex}, Items Paid at ${itemsPaidIndex})`);
        
        // Scan from line 0 to itemsPaidIndex (or end of document)
        const parseEnd = itemsPaidIndex < lines.length ? itemsPaidIndex : lines.length;
        
        for (let i = 0; i < parseEnd; i++) {
            const line = lines[i];
            const normalized = normalizeWhitespace(line);

            // Skip if this is another header or section marker
            if (
                transactionHeaderRegex.test(normalized) ||
                itemsPaidHeaderRegex.test(normalized) ||
                normalized.toLowerCase().includes('joint owner') ||
                normalized.toLowerCase().includes('e-checking') ||
                (normalized.toLowerCase().includes('for ') && normalized.toLowerCase().includes('murray'))
            ) {
                continue;
            }

            // Simplified approach: Look for MM-DD pattern, then extract amount and description
            // Navy Federal format: "07-25 Description | 117.55- | 3,300.62" or "07-25 Description 117.55- 3,300.62"
            const dateMatch = line.match(/^(\d{2}-\d{2})\s+(.+)$/);
            if (dateMatch) {
                // Log first few transaction-like lines for debugging
                if (transactions.length < 3) {
                    console.log(`PDF Parser: Found date pattern at line ${i}: "${line.substring(0, 100)}"`);
                }
                const dateStr = dateMatch[1];
                const restOfLine = dateMatch[2];
                
                // Skip balance/dividend lines
                if (
                    restOfLine.toLowerCase().startsWith('beginning balance') ||
                    restOfLine.toLowerCase().startsWith('ending balance') ||
                    restOfLine.toLowerCase().startsWith('dividend')
                ) {
                    continue;
                }
                
                // Extract amount - look for pattern like "117.55-" or "2,171.41" (with or without trailing minus)
                // Amount is typically before the last number (which is balance)
                // Try multiple patterns to find the amount
                let amountStr: string | undefined;
                
                // Pattern 1: Amount with trailing minus: "117.55-"
                const amountWithMinus = restOfLine.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})-\s*)/);
                if (amountWithMinus) {
                    amountStr = amountWithMinus[1].trim();
                } else {
                    // Pattern 2: Two numbers at the end - first is amount, second is balance
                    const twoNumbers = restOfLine.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2}))\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2}))\s*$/);
                    if (twoNumbers) {
                        // First number is amount, second is balance
                        amountStr = twoNumbers[1];
                    } else {
                        // Pattern 3: Single number that looks like an amount (has decimal)
                        const singleAmount = restOfLine.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2}))\s*$/);
                        if (singleAmount) {
                            amountStr = singleAmount[1];
                        }
                    }
                }
                
                if (amountStr) {
                    // Extract description - everything before the amount
                    const amountIndex = restOfLine.indexOf(amountStr);
                    let detail = restOfLine.substring(0, amountIndex).trim().replace(/\|/g, '').trim();
                    
                    // If we couldn't find amount in the string, try to extract it differently
                    if (amountIndex < 0 || detail.length < 3) {
                        // Try to find amount by looking for the pattern at the end
                        const amountAtEnd = restOfLine.match(/(.+?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})-\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2}))\s*$/);
                        if (amountAtEnd) {
                            detail = amountAtEnd[1].trim().replace(/\|/g, '').trim();
                            amountStr = amountAtEnd[2].trim();
                        }
                    }
                    
                    // Validate date
                    const [month, day] = dateStr.split('-').map(n => parseInt(n, 10));
                    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && detail.length > 2) {
                        const amount = parseAmount(amountStr);
                        if (amount !== null && Math.abs(amount) > 0.01) { // Ignore tiny amounts
                            const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const description = extractDescription(detail);
                            
                            transactions.push({
                                rawLine: line,
                                date: isoDate,
                                description: description.slice(0, 255),
                                amount,
                            });
                            continue; // Skip to next line
                        }
                    }
                }
            }
            
            // Fallback: Try original regex patterns
            let fullRowMatch = line.match(fullRowWithPipeRegex);
            if (fullRowMatch) {
                // Pipe-separated format
            } else {
                fullRowMatch = line.match(fullRowRegex);
            }
            
            if (fullRowMatch) {
                const dateStr = fullRowMatch[1];
                const detail = fullRowMatch[2].trim();
                const amountStr = fullRowMatch[3];

                // Skip balance/dividend lines
                if (
                    detail.toLowerCase().startsWith('beginning balance') ||
                    detail.toLowerCase().startsWith('ending balance') ||
                    detail.toLowerCase().startsWith('dividend')
                ) {
                    continue;
                }

                // Validate date
                const [month, day] = dateStr.split('-').map(n => parseInt(n, 10));
                if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                    const amount = parseAmount(amountStr);
                    if (amount !== null) {
                        const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const description = extractDescription(detail);
                        
                        transactions.push({
                            rawLine: line,
                            date: isoDate,
                            description: description.slice(0, 255),
                            amount,
                        });
                    }
                }
                continue; // Skip to next line since we processed this as a full row
            }
            
            // Try lenient pattern (no balance required)
            const lenientMatch = line.match(lenientRowRegex);
            if (lenientMatch) {
                const dateStr = lenientMatch[1];
                const detail = lenientMatch[2].trim();
                const amountStr = lenientMatch[3];

                // Skip balance/dividend lines
                if (
                    detail.toLowerCase().startsWith('beginning balance') ||
                    detail.toLowerCase().startsWith('ending balance') ||
                    detail.toLowerCase().startsWith('dividend')
                ) {
                    continue;
                }

                // Validate date
                const [month, day] = dateStr.split('-').map(n => parseInt(n, 10));
                if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                    const amount = parseAmount(amountStr);
                    if (amount !== null) {
                        const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const description = extractDescription(detail);
                        
                        transactions.push({
                            rawLine: line,
                            date: isoDate,
                            description: description.slice(0, 255),
                            amount,
                        });
                    }
                }
                continue;
            }
        }

        // Step 3: Collect amounts AFTER the header (but before Items Paid) - for separated format
        // Note: amounts array already initialized above
        const amountSectionStart = headerIndex >= 0 ? headerIndex + 1 : 0;
        for (let i = amountSectionStart; i < itemsPaidIndex; i++) {
            const line = lines[i];
            const normalized = normalizeWhitespace(line);

            // Skip if this is another header or section marker
            if (
                transactionHeaderRegex.test(normalized) ||
                itemsPaidHeaderRegex.test(normalized) ||
                normalized.toLowerCase().includes('joint owner') ||
                normalized.toLowerCase().includes('e-checking') ||
                (normalized.toLowerCase().includes('for ') && normalized.toLowerCase().includes('murray'))
            ) {
                continue;
            }

            // Skip if this line already matched as a full row (has date pattern)
            if (/^\d{2}-\d{2}/.test(line)) {
                continue;
            }

            // Try to match amount + balance pattern
            const amountMatch = line.match(amountPattern);
            if (amountMatch) {
                const amount = parseAmount(amountMatch[1]);
                if (amount !== null) {
                    amounts.push(amount);
                }
            } else {
                // Also try single amount pattern (just amount, no balance)
                const singleAmountPattern = /(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?-?)\s*-?$/;
                const singleMatch = line.match(singleAmountPattern);
                if (singleMatch) {
                    const amount = parseAmount(singleMatch[1]);
                    if (amount !== null && Math.abs(amount) > 0.01) { // Ignore tiny amounts
                        amounts.push(amount);
                    }
                }
            }
        }
        
        console.log(`PDF Parser: Collected ${amounts.length} amounts after header`);
        if (amounts.length > 0) {
            console.log(`PDF Parser: First amount: ${amounts[0]}, Last amount: ${amounts[amounts.length - 1]}`);
        }
        
        console.log(`PDF Parser: Found ${transactions.length} full-row transactions`);

        // Step 4: Match detail lines with amounts by position (for separated format)
        // Only do this if we didn't already find full-row transactions
        if (transactions.length === 0 && detailLines.length > 0 && amounts.length > 0) {
            const minLength = Math.min(detailLines.length, amounts.length);

            console.log(`PDF Parser: Matching ${detailLines.length} detail lines with ${amounts.length} amounts (${minLength} transactions)`);

            for (let i = 0; i < minLength; i++) {
                const detailLine = detailLines[i];
                const amount = amounts[i];

                // Build ISO date
                const [month, day] = detailLine.date.split('-').map(n => parseInt(n, 10));
                const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                // Extract description
                const description = extractDescription(detailLine.detail);

                transactions.push({
                    rawLine: detailLine.rawLine,
                    date: isoDate,
                    description: description.slice(0, 255),
                    amount,
                });
            }
        }

        // Fallback: Try parsing Items Paid section (even if we found some transactions, Items Paid might have more)
        if (itemsPaidIndex < lines.length) {
            console.log(`PDF Parser: Trying Items Paid section (found ${transactions.length} transactions so far)...`);
            
            // Items Paid format: MM-DD TYPE AMOUNT (e.g., "07-29 ACH 213.00")
            // More lenient: just look for MM-DD followed by text and amount
            const itemsPaidRegex = /^(\d{2}-\d{2})\s+(.+?)\s+(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)$/i;
            
            for (let i = itemsPaidIndex + 1; i < Math.min(itemsPaidIndex + 200, lines.length); i++) {
                const line = lines[i];
                const normalized = normalizeWhitespace(line);
                
                // Stop if we hit a new section
                if (
                    normalized.toLowerCase().includes('savings') ||
                    normalized.toLowerCase().includes('disclosure') ||
                    normalized.toLowerCase().includes('statement period') ||
                    transactionHeaderRegex.test(normalized)
                ) {
                    break;
                }
                
                const match = line.match(itemsPaidRegex);
                if (match) {
                    const dateStr = match[1];
                    const type = match[2].trim();
                    const amountStr = match[3];
                    
                    // Skip if type looks like it's not a transaction type
                    if (type.toLowerCase().includes('date') || type.toLowerCase().includes('item') || type.toLowerCase().includes('amount')) {
                        continue;
                    }
                    
                    // Validate date
                    const [month, day] = dateStr.split('-').map(n => parseInt(n, 10));
                    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                        const amount = parseAmount(amountStr);
                        if (amount !== null && Math.abs(amount) > 0.01) { // Ignore tiny amounts
                            const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            
                            // Clean up description
                            let description = type;
                            // Remove common prefixes
                            description = description
                                .replace(/^(ACH|POS|DEBIT|CREDIT|DEPOSIT|WITHDRAWAL|TRANSFER|ZELLE)\s+/i, '')
                                .trim();
                            
                            if (description.length < 2) {
                                description = type; // Fallback to original
                            }
                            
                            transactions.push({
                                rawLine: line,
                                date: isoDate,
                                description: description.slice(0, 255),
                                amount,
                            });
                        }
                    }
                }
            }
            
            console.log(`PDF Parser: Found ${transactions.length} transactions from Items Paid section`);
        }

        if (transactions.length === 0) {
            // Better error reporting
            const firstPageLines = lines.slice(0, 50).join('\n');
            throw new Error(
                `No transactions could be extracted from the PDF. The format may not be supported.\n\n` +
                `Found ${detailLines.length} detail lines and ${amounts.length} amounts.\n` +
                `Looking for header pattern: "Date Transaction Detail Amount($) Balance($)"\n` +
                `First 50 lines of PDF:\n${firstPageLines}`
            );
        }

        return transactions;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to parse PDF file.');
    }
}
