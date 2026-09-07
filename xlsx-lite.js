(function (root) {
  "use strict";

  var encoder = new TextEncoder();
  var decoder = new TextDecoder("utf-8");
  var crcTable = null;

  function buildCrcTable() {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  }

  function crc32(bytes) {
    if (!crcTable) crcTable = buildCrcTable();
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function concatBytes(parts) {
    var length = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
    var out = new Uint8Array(length);
    var offset = 0;
    parts.forEach(function (part) { out.set(part, offset); offset += part.length; });
    return out;
  }

  function u16(value) {
    var out = new Uint8Array(2);
    new DataView(out.buffer).setUint16(0, value, true);
    return out;
  }

  function u32(value) {
    var out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value >>> 0, true);
    return out;
  }

  function dosStamp(date) {
    date = date || new Date();
    var year = Math.max(1980, date.getFullYear());
    return {
      time: ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | (Math.floor(date.getSeconds() / 2) & 31),
      date: (((year - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31)
    };
  }

  function zipStore(entries) {
    var localParts = [];
    var centralParts = [];
    var offset = 0;
    var stamp = dosStamp(new Date());
    entries.forEach(function (entry) {
      var name = encoder.encode(entry.name.replace(/\\/g, "/"));
      var data = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
      var crc = crc32(data);
      var local = concatBytes([
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(stamp.time), u16(stamp.date),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data
      ]);
      localParts.push(local);
      centralParts.push(concatBytes([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(stamp.time), u16(stamp.date),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0),
        u16(0), u32(0), u32(offset), name
      ]));
      offset += local.length;
    });
    var central = concatBytes(centralParts);
    var end = concatBytes([
      u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
      u32(central.length), u32(offset), u16(0)
    ]);
    return concatBytes(localParts.concat([central, end]));
  }

  function findEndOfCentralDirectory(view) {
    var earliest = Math.max(0, view.byteLength - 65557);
    for (var pos = view.byteLength - 22; pos >= earliest; pos--) {
      if (view.getUint32(pos, true) === 0x06054b50) return pos;
    }
    throw new Error("El archivo no parece ser un .xlsx valido");
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== "function") throw new Error("Este navegador es demasiado antiguo para abrir .xlsx. Use Chrome o Edge actualizado.");
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    var view = new DataView(arrayBuffer);
    var eocd = findEndOfCentralDirectory(view);
    var count = view.getUint16(eocd + 10, true);
    var cursor = view.getUint32(eocd + 16, true);
    var entries = {};
    for (var i = 0; i < count; i++) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Indice ZIP invalido");
      var method = view.getUint16(cursor + 10, true);
      var compressedSize = view.getUint32(cursor + 20, true);
      var nameLength = view.getUint16(cursor + 28, true);
      var extraLength = view.getUint16(cursor + 30, true);
      var commentLength = view.getUint16(cursor + 32, true);
      var localOffset = view.getUint32(cursor + 42, true);
      var name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
      var localNameLength = view.getUint16(localOffset + 26, true);
      var localExtraLength = view.getUint16(localOffset + 28, true);
      var dataStart = localOffset + 30 + localNameLength + localExtraLength;
      var compressed = bytes.slice(dataStart, dataStart + compressedSize);
      if (method === 0) entries[name] = compressed;
      else if (method === 8) entries[name] = await inflateRaw(compressed);
      else throw new Error("Compresion XLSX no compatible: " + method);
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  function parseXml(bytes, label) {
    if (!bytes) throw new Error("Falta " + label + " en el archivo .xlsx");
    var xml = decoder.decode(bytes);
    if (xml.indexOf("<") < 0) throw new Error("XML invalido en " + label);
    return xml;
  }

  function xmlDecode(value) {
    return String(value || "").replace(/&#x([0-9a-f]+);/gi, function (_, hex) { return String.fromCodePoint(parseInt(hex, 16)); })
      .replace(/&#([0-9]+);/g, function (_, decimal) { return String.fromCodePoint(parseInt(decimal, 10)); })
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  }

  function xmlAttribute(tag, name) {
    var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var match = String(tag || "").match(new RegExp("(?:^|\\s)" + escaped + "\\s*=\\s*[\"']([^\"']*)[\"']", "i"));
    return match ? xmlDecode(match[1]) : "";
  }

  function textFromXml(xml) {
    var out = "";
    String(xml || "").replace(/<t\b[^>]*>([\s\S]*?)<\/t>/gi, function (_, value) { out += xmlDecode(value); return _; });
    return out;
  }

  function normalizePath(base, target) {
    if (target.charAt(0) === "/") return target.slice(1);
    var parts = base.split("/");
    parts.pop();
    target.split("/").forEach(function (part) {
      if (!part || part === ".") return;
      if (part === "..") parts.pop();
      else parts.push(part);
    });
    return parts.join("/");
  }

  function columnIndex(reference) {
    var match = String(reference || "").match(/^([A-Z]+)/i);
    if (!match) return 0;
    var value = 0;
    match[1].toUpperCase().split("").forEach(function (letter) { value = value * 26 + letter.charCodeAt(0) - 64; });
    return value - 1;
  }

  function worksheetRows(xml, sharedStrings) {
    var rows = [];
    var rowMatches = [];
    String(xml || "").replace(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi, function (_, attributes, body) { rowMatches.push({ attributes: attributes, body: body }); return _; });
    for (var r = 0; r < rowMatches.length; r++) {
      var rowMatch = rowMatches[r];
      var rowNumber = Math.max(1, Number(xmlAttribute(rowMatch.attributes, "r") || r + 1));
      var row = rows[rowNumber - 1] || [];
      var cells = [];
      rowMatch.body.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi, function (_, attributes, body) { cells.push({ attributes: attributes, body: body || "" }); return _; });
      for (var c = 0; c < cells.length; c++) {
        var cell = cells[c];
        var index = columnIndex(xmlAttribute(cell.attributes, "r"));
        var type = xmlAttribute(cell.attributes, "t") || "n";
        var valueMatch = cell.body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
        var raw = valueMatch ? xmlDecode(valueMatch[1]) : "";
        var value = raw;
        if (type === "s") value = sharedStrings[Number(raw)] == null ? "" : sharedStrings[Number(raw)];
        else if (type === "inlineStr") value = textFromXml(cell.body);
        else if (type === "b") value = raw === "1";
        else if (type === "n" || !type) value = raw === "" ? "" : Number(raw);
        row[index] = value;
      }
      rows[rowNumber - 1] = row;
    }
    return rows;
  }

  async function readWorkbook(input) {
    var arrayBuffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
    var entries = await unzip(arrayBuffer);
    var workbookPath = "xl/workbook.xml";
    var workbook = parseXml(entries[workbookPath], "el libro");
    var rels = parseXml(entries["xl/_rels/workbook.xml.rels"], "las relaciones del libro");
    var relationships = {};
    rels.replace(/<Relationship\b[^>]*>/gi, function (tag) { relationships[xmlAttribute(tag, "Id")] = xmlAttribute(tag, "Target"); return tag; });
    var sharedStrings = [];
    if (entries["xl/sharedStrings.xml"]) {
      var shared = parseXml(entries["xl/sharedStrings.xml"], "los textos compartidos");
      shared.replace(/<si\b[^>]*>([\s\S]*?)<\/si>/gi, function (_, body) { sharedStrings.push(textFromXml(body)); return _; });
    }
    var result = { sheets: [] };
    var sheetNodes = [];
    workbook.replace(/<sheet\b[^>]*>/gi, function (tag) { sheetNodes.push(tag); return tag; });
    for (var n = 0; n < sheetNodes.length; n++) {
      var sheetNode = sheetNodes[n];
      var relId = xmlAttribute(sheetNode, "r:id");
      var target = relationships[relId];
      if (!target) continue;
      var path = normalizePath(workbookPath, target);
      var sheetName = xmlAttribute(sheetNode, "name") || ("Hoja " + (n + 1));
      var sheetXmlText = parseXml(entries[path], "la hoja " + sheetName);
      result.sheets.push({ name: sheetName, rows: worksheetRows(sheetXmlText, sharedStrings) });
    }
    if (!result.sheets.length) throw new Error("El archivo .xlsx no contiene hojas legibles");
    return result;
  }

  function xmlEscape(value) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  function columnName(index) {
    var name = "";
    var n = index + 1;
    while (n > 0) { var r = (n - 1) % 26; name = String.fromCharCode(65 + r) + name; n = Math.floor((n - 1) / 26); }
    return name;
  }

  function cellXml(value, rowIndex, columnIndexValue, style) {
    var ref = columnName(columnIndexValue) + (rowIndex + 1);
    var styleAttr = style ? " s=\"" + style + "\"" : "";
    if (typeof value === "number" && isFinite(value)) return "<c r=\"" + ref + "\"" + styleAttr + "><v>" + value + "</v></c>";
    if (typeof value === "boolean") return "<c r=\"" + ref + "\" t=\"b\"" + styleAttr + "><v>" + (value ? 1 : 0) + "</v></c>";
    var text = String(value == null ? "" : value);
    return "<c r=\"" + ref + "\" t=\"inlineStr\"" + styleAttr + "><is><t xml:space=\"preserve\">" + xmlEscape(text) + "</t></is></c>";
  }

  function sheetXml(sheet) {
    var rows = sheet.rows || [];
    var maxColumns = rows.reduce(function (max, row) { return Math.max(max, (row || []).length); }, 0);
    var lastCell = columnName(Math.max(0, maxColumns - 1)) + Math.max(1, rows.length);
    var columns = (sheet.widths || []).map(function (width, index) {
      return "<col min=\"" + (index + 1) + "\" max=\"" + (index + 1) + "\" width=\"" + Number(width || 12) + "\" customWidth=\"1\"/>";
    }).join("");
    var xmlRows = rows.map(function (row, rowIndex) {
      var cells = (row || []).map(function (value, colIndex) {
        var style = rowIndex === 0 ? 1 : (sheet.textColumns || []).indexOf(colIndex) >= 0 ? 4 : (sheet.currencyColumns || []).indexOf(colIndex) >= 0 ? 2 : (sheet.decimalColumns || []).indexOf(colIndex) >= 0 ? 3 : 0;
        return cellXml(value, rowIndex, colIndex, style);
      }).join("");
      return "<row r=\"" + (rowIndex + 1) + "\"" + (rowIndex === 0 ? " ht=\"24\" customHeight=\"1\"" : "") + ">" + cells + "</row>";
    }).join("");
    return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
      + "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">"
      + "<dimension ref=\"A1:" + lastCell + "\"/><sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>"
      + "<sheetFormatPr defaultRowHeight=\"18\"/>" + (columns ? "<cols>" + columns + "</cols>" : "")
      + "<sheetData>" + xmlRows + "</sheetData>"
      + (rows.length && maxColumns ? "<autoFilter ref=\"A1:" + lastCell + "\"/>" : "")
      + "<pageMargins left=\"0.3\" right=\"0.3\" top=\"0.5\" bottom=\"0.5\" header=\"0.2\" footer=\"0.2\"/></worksheet>";
  }

  function writeWorkbook(sheets) {
    if (!Array.isArray(sheets) || !sheets.length) throw new Error("No hay hojas para exportar");
    var now = new Date().toISOString();
    var contentOverrides = sheets.map(function (_, i) { return "<Override PartName=\"/xl/worksheets/sheet" + (i + 1) + ".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>"; }).join("");
    var workbookSheets = sheets.map(function (sheet, i) { return "<sheet name=\"" + xmlEscape(String(sheet.name || ("Hoja " + (i + 1))).slice(0, 31)) + "\" sheetId=\"" + (i + 1) + "\" r:id=\"rId" + (i + 1) + "\"/>"; }).join("");
    var workbookRels = sheets.map(function (_, i) { return "<Relationship Id=\"rId" + (i + 1) + "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet" + (i + 1) + ".xml\"/>"; }).join("");
    workbookRels += "<Relationship Id=\"rId" + (sheets.length + 1) + "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>";
    var entries = [
      { name: "[Content_Types].xml", data: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/><Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/><Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>" + contentOverrides + "</Types>" },
      { name: "_rels/.rels", data: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/><Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/></Relationships>" },
      { name: "docProps/core.xml", data: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><dc:title>Stock La Vieja Esquina</dc:title><dc:creator>La Vieja Esquina</dc:creator><dcterms:created xsi:type=\"dcterms:W3CDTF\">" + now + "</dcterms:created><dcterms:modified xsi:type=\"dcterms:W3CDTF\">" + now + "</dcterms:modified></cp:coreProperties>" },
      { name: "docProps/app.xml", data: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\"><Application>La Vieja Esquina</Application></Properties>" },
      { name: "xl/workbook.xml", data: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><bookViews><workbookView/></bookViews><sheets>" + workbookSheets + "</sheets><calcPr calcId=\"0\"/></workbook>" },
      { name: "xl/_rels/workbook.xml.rels", data: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" + workbookRels + "</Relationships>" },
      { name: "xl/styles.xml", data: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><numFmts count=\"2\"><numFmt numFmtId=\"164\" formatCode=\"$#,##0.00\"/><numFmt numFmtId=\"165\" formatCode=\"0.###\"/></numFmts><fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><color rgb=\"FFFFFFFF\"/><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts><fills count=\"3\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF176B63\"/><bgColor indexed=\"64\"/></patternFill></fill></fills><borders count=\"2\"><border/><border><left style=\"thin\"><color rgb=\"FFD6E2DF\"/></left><right style=\"thin\"><color rgb=\"FFD6E2DF\"/></right><top style=\"thin\"><color rgb=\"FFD6E2DF\"/></top><bottom style=\"thin\"><color rgb=\"FFD6E2DF\"/></bottom></border></borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs><cellXfs count=\"5\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment horizontal=\"center\" vertical=\"center\"/></xf><xf numFmtId=\"164\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"165\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"49\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/></cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>" }
    ];
    sheets.forEach(function (sheet, index) { entries.push({ name: "xl/worksheets/sheet" + (index + 1) + ".xml", data: sheetXml(sheet) }); });
    var bytes = zipStore(entries);
    return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  root.XlsxLite = { read: readWorkbook, write: writeWorkbook };
})(window);
