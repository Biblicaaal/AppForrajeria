(function (root) {
  "use strict";

  // Code 128 patterns are kept locally so labels work with no internet connection.
  var CODE128_PATTERNS = [
    "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212",
    "112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131",
    "311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321",
    "112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121",
    "313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
    "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114",
    "122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212",
    "124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113",
    "114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"
  ];

  function normalize(value) {
    return String(value == null ? "" : value).trim().replace(/\s+/g, "").toUpperCase();
  }

  function validate(value) {
    var code = normalize(value);
    if (!code) return { ok: false, missing: true, code: "", error: "Sin codigo: se puede asignar un codigo interno LVE" };
    if (code.length > 32) return { ok: false, missing: false, code: code, error: "Codigo demasiado largo para una etiqueta de 58 mm" };
    for (var i = 0; i < code.length; i += 1) {
      var charCode = code.charCodeAt(i);
      if (charCode < 32 || charCode > 126) return { ok: false, missing: false, code: code, error: "El codigo contiene caracteres incompatibles con Code 128" };
    }
    return { ok: true, missing: false, code: code, error: "" };
  }

  function codeValues(code) {
    var numeric = /^\d+$/.test(code) && code.length >= 4;
    var values = [];
    var start;
    var index = 0;
    if (numeric && code.length % 2 === 0) {
      start = 105; // Code 128 C: numeric pairs.
    } else {
      start = 104; // Code 128 B.
      if (numeric && code.length % 2 === 1) {
        values.push(code.charCodeAt(0) - 32);
        values.push(99); // Switch to Code 128 C for the remaining pairs.
        index = 1;
      }
    }
    if (numeric) {
      for (; index < code.length; index += 2) values.push(Number(code.slice(index, index + 2)));
    } else {
      for (index = 0; index < code.length; index += 1) values.push(code.charCodeAt(index) - 32);
    }
    var checksum = start;
    values.forEach(function (value, valueIndex) { checksum += value * (valueIndex + 1); });
    return [start].concat(values, [checksum % 103, 106]);
  }

  function barcodeGeometry(value) {
    var validation = validate(value);
    if (!validation.ok) return { ok: false, error: validation.error, code: validation.code, bars: [], modules: 0 };
    var patterns = codeValues(validation.code).map(function (value) { return CODE128_PATTERNS[value]; });
    var quiet = 10;
    var x = quiet;
    var bars = [];
    patterns.forEach(function (pattern) {
      var black = true;
      for (var i = 0; i < pattern.length; i += 1) {
        var width = Number(pattern.charAt(i));
        if (black) bars.push({ x: x, width: width });
        x += width;
        black = !black;
      }
    });
    return { ok: true, code: validation.code, bars: bars, modules: x + quiet };
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character];
    });
  }

  function svg(value) {
    var geometry = barcodeGeometry(value);
    if (!geometry.ok) return "";
    var rects = geometry.bars.map(function (bar) {
      return "<rect x='" + bar.x + "' y='0' width='" + bar.width + "' height='48'/>";
    }).join("");
    return "<svg class='barcode-svg' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 " + geometry.modules + " 48' preserveAspectRatio='none' role='img' aria-label='Codigo " + escapeHtml(geometry.code) + "'><g fill='#000'>" + rects + "</g></svg>";
  }

  function splitName(value) {
    var text = String(value || "Producto").trim().replace(/\s+/g, " ");
    if (text.length <= 28) return [text];
    var words = text.split(" ");
    var lines = [""];
    words.forEach(function (word) {
      var current = lines[lines.length - 1];
      if (lines.length < 2 && current && (current + " " + word).length > 28) lines.push(word);
      else lines[lines.length - 1] = current ? current + " " + word : word;
    });
    if (lines[1] && lines[1].length > 31) lines[1] = lines[1].slice(0, 28) + "...";
    return lines.slice(0, 2);
  }

  function printDocument(items, businessName) {
    var labels = (items || []).map(function (item) {
      var lines = splitName(item.name);
      return "<section class='label'><div class='name'>" + lines.map(function (line) { return "<span>" + escapeHtml(line) + "</span>"; }).join("") + "</div>"
        + svg(item.barcode)
        + "<div class='code'>" + escapeHtml(normalize(item.barcode)) + "</div>"
        + "<div class='store'>" + escapeHtml(businessName || "LA VIEJA ESQUINA") + "</div></section>";
    }).join("");
    return "<!doctype html><html><head><meta charset='utf-8'><title>Etiquetas 58 mm</title><style>"
      + "@page{size:58mm 34mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,sans-serif}"
      + ".label{width:58mm;height:34mm;padding:1.7mm 2.2mm 1.2mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow:hidden;break-after:page;page-break-after:always}"
      + ".label:last-child{break-after:auto;page-break-after:auto}.name{height:8.2mm;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10pt;font-weight:800;line-height:1.05;text-align:center;overflow:hidden}"
      + ".name span{display:block;max-width:100%;white-space:nowrap}.barcode-svg{display:block;width:52mm;height:14mm;shape-rendering:crispEdges}.code{font:700 9pt/1.1 'Courier New',monospace;letter-spacing:.5px;margin-top:.5mm}.store{font-size:6.5pt;font-weight:700;margin-top:.6mm;letter-spacing:.25px}"
      + "</style></head><body>" + labels + "</body></html>";
  }

  function pdfSafe(value) {
    var text = String(value == null ? "" : value).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2026/g, "...");
    var out = "";
    for (var i = 0; i < text.length; i += 1) {
      var code = text.charCodeAt(i);
      var character = code <= 255 ? text.charAt(i) : "?";
      if (character === "\\" || character === "(" || character === ")") out += "\\";
      out += character;
    }
    return out;
  }

  function centeredPdfText(text, fontSize, y, pageWidth) {
    var approximateWidth = String(text).length * fontSize * 0.52;
    var x = Math.max(4, (pageWidth - approximateWidth) / 2);
    return "BT /F1 " + fontSize + " Tf " + x.toFixed(2) + " " + y.toFixed(2) + " Td (" + pdfSafe(text) + ") Tj ET\n";
  }

  function pdfContent(item, pageWidth) {
    var geometry = barcodeGeometry(item.barcode);
    var lines = splitName(item.name);
    var stream = centeredPdfText(lines[0], lines.length > 1 ? 8.5 : 9.5, lines.length > 1 ? 86 : 82, pageWidth);
    if (lines[1]) stream += centeredPdfText(lines[1], 8.5, 76, pageWidth);
    var left = 5.7;
    var availableWidth = pageWidth - 11.4;
    var moduleWidth = availableWidth / geometry.modules;
    geometry.bars.forEach(function (bar) {
      stream += (left + bar.x * moduleWidth).toFixed(3) + " 29 " + (bar.width * moduleWidth).toFixed(3) + " 38 re f\n";
    });
    stream += centeredPdfText(geometry.code, 8.5, 17, pageWidth);
    stream += centeredPdfText("LA VIEJA ESQUINA", 6.5, 8.5, pageWidth);
    return stream;
  }

  function binaryBytes(value) {
    var bytes = new Uint8Array(value.length);
    for (var i = 0; i < value.length; i += 1) bytes[i] = value.charCodeAt(i) & 255;
    return bytes;
  }

  function buildPdf(items) {
    var rows = (items || []).filter(function (item) { return barcodeGeometry(item.barcode).ok; });
    if (!rows.length) throw new Error("No hay codigos validos para generar el PDF");
    var pageWidth = 164.41; // 58 mm in PDF points.
    var pageHeight = 96.38; // 34 mm.
    var objects = {};
    var kids = [];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    rows.forEach(function (item, index) {
      var pageObject = 4 + index * 2;
      var contentObject = pageObject + 1;
      var content = pdfContent(item, pageWidth);
      kids.push(pageObject + " 0 R");
      objects[pageObject] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageWidth + " " + pageHeight + "] /Resources << /Font << /F1 3 0 R >> >> /Contents " + contentObject + " 0 R >>";
      objects[contentObject] = "<< /Length " + content.length + " >>\nstream\n" + content + "endstream";
    });
    objects[2] = "<< /Type /Pages /Count " + rows.length + " /Kids [" + kids.join(" ") + "] >>";
    var maxObject = 3 + rows.length * 2;
    var pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    var offsets = [0];
    for (var objectNumber = 1; objectNumber <= maxObject; objectNumber += 1) {
      offsets[objectNumber] = pdf.length;
      pdf += objectNumber + " 0 obj\n" + objects[objectNumber] + "\nendobj\n";
    }
    var xref = pdf.length;
    pdf += "xref\n0 " + (maxObject + 1) + "\n0000000000 65535 f \n";
    for (objectNumber = 1; objectNumber <= maxObject; objectNumber += 1) pdf += String(offsets[objectNumber]).padStart(10, "0") + " 00000 n \n";
    pdf += "trailer\n<< /Size " + (maxObject + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
    return new Blob([binaryBytes(pdf)], { type: "application/pdf" });
  }

  root.ForrajeriaBarcodeLabels = {
    validate: validate,
    geometry: barcodeGeometry,
    svg: svg,
    printDocument: printDocument,
    buildPdf: buildPdf,
    sample: function () {
      return buildPdf([
        { name: "Royal CC", barcode: "LVE00100001" },
        { name: "Collar reforzado mediano", barcode: "7791234567890" }
      ]);
    }
  };
})(window);
