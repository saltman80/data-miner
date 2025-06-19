(function (root) {
  function convertJsonToCsv(data, opts = {}) {
    if (!Array.isArray(data) || data.length === 0) return '';
    const {
      delimiter = ',',
      includeHeaders = true,
      quoteChar = '"',
      headers: customHeaders
    } = opts;

    const headers = Array.isArray(customHeaders) && customHeaders.length
      ? customHeaders
      : Array.from(
          data.reduce((set, item) => {
            Object.keys(item).forEach(key => set.add(key));
            return set;
          }, new Set())
        );

    const escapeValue = (value) => {
      if (value == null) return '';
      let str;
      if (typeof value === 'object') {
        try {
          str = JSON.stringify(value);
        } catch {
          str = String(value);
        }
      } else {
        str = String(value);
      }
      if (str.length && ['=', '+', '-', '@'].includes(str[0])) {
        str = '\'' + str;
      }
      const needsQuotes =
        str.includes(delimiter) ||
        str.includes('\n') ||
        str.includes('\r') ||
        str.includes(quoteChar);
      if (needsQuotes) {
        const escaped = str.split(quoteChar).join(quoteChar + quoteChar);
        return quoteChar + escaped + quoteChar;
      }
      return str;
    };

    const rows = data.map(item =>
      headers.map(header => escapeValue(item[header])).join(delimiter)
    );

    let csv = '';
    if (includeHeaders) {
      csv += headers.map(escapeValue).join(delimiter);
      if (rows.length) csv += '\n';
    }
    csv += rows.join('\n');
    return csv;
  }

  root.convertJsonToCsv = convertJsonToCsv;
})(typeof self !== 'undefined' ? self : this);