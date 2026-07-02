import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";

// Load environment variables from .env
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parser is crucial for incoming POST payloads
  app.use(express.json());

  // API Route: Send notification to Discord, Telegram, or LINE
  app.post("/api/send-notification", async (req, res) => {
    try {
      const { platform, config, data } = req.body;

      if (!platform) {
        return res.status(400).json({ success: false, error: "Missing platform" });
      }

      if (platform === "discord") {
        const { webhookUrl } = config;
        if (!webhookUrl) {
          return res.status(400).json({ success: false, error: "Missing Discord Webhook URL" });
        }
        
        const response = await fetch(webhookUrl.trim(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          return res.status(200).json({ success: true });
        } else {
          const errText = await response.text();
          return res.status(response.status).json({ success: false, error: errText });
        }

      } else if (platform === "telegram") {
        const { botToken, chatId } = config;
        if (!botToken || !chatId) {
          return res.status(400).json({ success: false, error: "Missing Telegram Bot Token or Chat ID" });
        }

        const response = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: chatId.trim(),
            text: data.text,
            parse_mode: "HTML"
          })
        });

        if (response.ok) {
          return res.status(200).json({ success: true });
        } else {
          const errText = await response.text();
          return res.status(response.status).json({ success: false, error: errText });
        }

      } else if (platform === "line") {
        const { channelToken, recipientId } = config;
        if (!channelToken) {
          return res.status(400).json({ success: false, error: "Missing LINE Channel Access Token" });
        }

        // Sanitize token to avoid non-ISO-8859-1 header characters (crucial for copy-paste safety)
        let cleanToken = channelToken.replace(/[^\x20-\x7E]/g, '').trim();
        if (cleanToken.toLowerCase().startsWith("bearer ")) {
          cleanToken = cleanToken.slice(7).trim();
        }
        const rawRecipient = (recipientId || "").trim();
        
        // If recipientId is empty, "broadcast", or "all", send via Broadcast endpoint
        const isBroadcast = rawRecipient === "" || rawRecipient.toLowerCase() === "broadcast" || rawRecipient.toLowerCase() === "all";
        
        const endpoint = isBroadcast
          ? "https://api.line.me/v2/bot/message/broadcast"
          : "https://api.line.me/v2/bot/message/push";

        const messagePayload: any = {
          messages: [
            {
              type: "text",
              text: data.text
            }
          ]
        };

        if (!isBroadcast) {
          messagePayload.to = rawRecipient;
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${cleanToken}`
          },
          body: JSON.stringify(messagePayload)
        });

        if (response.ok) {
          return res.status(200).json({ success: true, mode: isBroadcast ? "broadcast" : "push" });
        } else {
          const errText = await response.text();
          return res.status(response.status).json({ success: false, error: errText });
        }
      }

      return res.status(400).json({ success: false, error: "Invalid platform" });
    } catch (error: any) {
      console.error("Error sending notification from proxy:", error);
      return res.status(500).json({ success: false, error: error.message || error });
    }
  });

  // API Route: Send Summary to LINE via Messaging API
  app.post("/api/send-line", async (req, res) => {
    try {
      const {
        channelAccessToken,
        recipientId,
        analyticsSummary,
        filterDetails,
        ingredientsCount,
        timestamp
      } = req.body;

      // Prioritize client-provided keys (e.g. from UI settings) first, then fall back to server env variables
      const token = (channelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
      let cleanToken = token.replace(/[^\x20-\x7E]/g, '').trim();
      if (cleanToken.toLowerCase().startsWith("bearer ")) {
        cleanToken = cleanToken.slice(7).trim();
      }
      const to = (recipientId || process.env.LINE_RECIPIENT_ID || process.env.LINE_GROUP_ID || "").trim();
      let cleanTo = to.replace(/[^\x20-\x7E]/g, '').trim();
      
      // Attempt to extract 33-character LINE ID from any copied text
      const lineIdMatch = cleanTo.match(/\b([UCR][0-9a-fA-F]{32})\b/);
      if (lineIdMatch) {
        cleanTo = lineIdMatch[1];
      }

      if (!cleanToken) {
        return res.status(400).json({
          success: false,
          error: "กรุณากำหนด LINE Channel Access Token ในส่วนการตั้งค่า หรือในไฟล์ .env ก่อนใช้งาน"
        });
      }

      if (!cleanTo) {
        return res.status(400).json({
          success: false,
          error: "กรุณากำหนด ID ผู้รับ (User ID, Group ID หรือ Room ID) ของ LINE ก่อนใช้งาน"
        });
      }

      const isBroadcast = cleanTo.toLowerCase() === "broadcast" || cleanTo.toLowerCase() === "all";

      // Validate LINE ID Format (starts with U, C, or R, followed by 32 hex chars, total 33 chars)
      const isLineIdValid = (id: string) => {
        return /^[UCR][0-9a-fA-F]{32}$/.test(id);
      };

      if (!isBroadcast && !isLineIdValid(cleanTo)) {
        return res.status(400).json({
          success: false,
          error: "ID ผู้รับไม่ถูกต้อง! รหัส LINE ID ของแท้จะต้องขึ้นต้นด้วยอักษร U (User ID), C (Group ID) หรือ R (Room ID) และตามด้วยรหัสตัวเลข/ตัวอักษรภาษาอังกฤษอีก 32 ตัวอักษร (รวม 33 ตัวอักษร) ตัวอย่างเช่น U1234567890abcdef1234567890abcdef (ไม่ใช่ไอดีผู้ใช้ทั่วไปสำหรับค้นหาเพื่อน หรือ LINE Basic ID สำหรับบอท)"
        });
      }

      // Format dynamic display values
      const avgYieldText = `${(analyticsSummary?.avgYield ?? 0).toFixed(1)}%`;
      const totalLossWeightText = `${(analyticsSummary?.totalLossWeight ?? 0).toFixed(2)} KG`;
      const totalLossValueText = `฿${(analyticsSummary?.totalLossValue ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      
      const filterMonthText = filterDetails?.month === "all" ? "ทั้งหมดทุกเดือน" : (filterDetails?.month || "-");
      const filterNameText = filterDetails?.name === "all" ? "ทั้งหมดทุกวัตถุดิบ" : (filterDetails?.name || "-");
      const filterSearchText = filterDetails?.search ? `"${filterDetails.search}"` : "ไม่มี";
      const totalItems = ingredientsCount ?? 0;

      // Construct a professional, compact, high-contrast Flex Message Bubble
      const flexBubble = {
        type: "bubble",
        size: "giga",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              "type": "text",
              "text": "Smart Yield Pro • Report",
              "weight": "bold",
              "color": "#10B981",
              "size": "xs"
            },
            {
              type: "text",
              text: "รายงานสรุปอัตราผลผลิต & ต้นทุน",
              weight: "bold",
              color: "#FFFFFF",
              size: "md",
              margin: "xs"
            }
          ],
          backgroundColor: "#0F172A",
          paddingAll: "16px"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "box",
                  layout: "vertical",
                  contents: [
                    {
                      type: "text",
                      text: "อัตราส่วนผลผลิตเฉลี่ย",
                      size: "xxs",
                      color: "#64748B",
                      weight: "bold"
                    },
                    {
                      type: "text",
                      text: avgYieldText,
                      size: "xl",
                      weight: "bold",
                      color: "#2563EB",
                      margin: "xs"
                    }
                  ],
                  flex: 1
                },
                {
                  type: "box",
                  layout: "vertical",
                  contents: [
                    {
                      type: "text",
                      text: "ปริมาณของเสียรวม",
                      size: "xxs",
                      color: "#64748B",
                      weight: "bold"
                    },
                    {
                      type: "text",
                      text: totalLossWeightText,
                      size: "xl",
                      weight: "bold",
                      color: "#D97706",
                      margin: "xs"
                    }
                  ],
                  flex: 1
                }
              ]
            },
            {
              type: "separator",
              margin: "md",
              color: "#F1F5F9"
            },
            {
              type: "box",
              layout: "vertical",
              margin: "md",
              contents: [
                {
                  type: "text",
                  text: "มูลค่าความสูญเสียโดยรวม (Loss Value)",
                  size: "xxs",
                  color: "#64748B",
                  weight: "bold"
                },
                {
                  type: "text",
                  text: totalLossValueText,
                  size: "xxl",
                  weight: "bold",
                  color: "#E11D48",
                  margin: "xs"
                }
              ]
            },
            {
              type: "separator",
              margin: "md",
              color: "#F1F5F9"
            },
            {
              type: "box",
              layout: "vertical",
              margin: "md",
              spacing: "xs",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "กรองตามเดือน:",
                      size: "xs",
                      color: "#64748B",
                      flex: 4
                    },
                    {
                      type: "text",
                      text: filterMonthText,
                      size: "xs",
                      color: "#334155",
                      weight: "bold",
                      align: "end",
                      flex: 8
                    }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "กรองวัตถุดิบ:",
                      size: "xs",
                      color: "#64748B",
                      flex: 4
                    },
                    {
                      type: "text",
                      text: filterNameText,
                      size: "xs",
                      color: "#334155",
                      weight: "bold",
                      align: "end",
                      flex: 8
                    }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "ค้นหาคำว่า:",
                      size: "xs",
                      color: "#64748B",
                      flex: 4
                    },
                    {
                      type: "text",
                      text: filterSearchText,
                      size: "xs",
                      color: "#334155",
                      weight: "bold",
                      align: "end",
                      flex: 8
                    }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "รายการที่ประมวลผล:",
                      size: "xs",
                      color: "#64748B",
                      flex: 4
                    },
                    {
                      type: "text",
                      text: `${totalItems} รายการล็อตวัตถุดิบ`,
                      size: "xs",
                      color: "#334155",
                      weight: "bold",
                      align: "end",
                      flex: 8
                    }
                  ]
                }
              ]
            }
          ],
          paddingAll: "16px"
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `อัปเดต ณ ${timestamp || new Date().toLocaleString("th-TH")}`,
              size: "xxs",
              color: "#94A3B8",
              align: "center"
            },
            {
              type: "text",
              text: "ส่งรายงานจากแอป Smart Yield Pro",
              size: "xxs",
              color: "#CBD5E1",
              align: "center",
              margin: "xs"
            }
          ],
          backgroundColor: "#F8FAFC",
          paddingAll: "8px"
        }
      };

      // Call LINE Messaging API - Push or Broadcast Message
      const endpoint = isBroadcast
        ? "https://api.line.me/v2/bot/message/broadcast"
        : "https://api.line.me/v2/bot/message/push";

      const bodyPayload: any = {
        messages: [
          {
            type: "flex",
            altText: `รายงานสรุปผลผลิตและต้นทุนวัตถุดิบอาหาร - Smart Yield Pro (Yield: ${avgYieldText}, Loss: ${totalLossValueText})`,
            contents: flexBubble
          }
        ]
      };

      if (!isBroadcast) {
        bodyPayload.to = cleanTo;
      }

      const lineResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cleanToken}`
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!lineResponse.ok) {
        const errText = await lineResponse.text();
        console.error("LINE Messaging API responded with error:", errText);
        
        let errorMsg = `LINE API Error: ${errText || lineResponse.statusText}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.message === "Failed to send messages") {
            errorMsg = "ส่งข้อความไม่สำเร็จ: โปรดตรวจสอบว่าผู้รับปลายทาง (User ID, Group ID, หรือ Room ID) ได้แอดหรือดึงบอทเข้าเป็นเพื่อนแล้ว รวมถึงตรวจสอบสิทธิ์ของ Channel Access Token ว่าถูกต้องและมีสิทธิ์พุชข้อความ";
          } else if (errJson.message) {
            errorMsg = `LINE API Error: ${errJson.message}`;
            if (errJson.details && errJson.details.length > 0) {
              const detailsStr = errJson.details.map((d: any) => `${d.property || ""}: ${d.message || ""}`).join(", ");
              errorMsg += ` (${detailsStr})`;
            }
          }
        } catch (e) {
          // Fallback to raw text error
        }

        return res.status(lineResponse.status).json({
          success: false,
          error: errorMsg
        });
      }

      return res.status(200).json({
        success: true,
        message: "ส่งสรุปผลการวิเคราะห์เข้า LINE สำเร็จเรียบร้อยแล้ว!"
      });
    } catch (error: any) {
      console.error("Error sending message to LINE:", error);
      return res.status(500).json({
        success: false,
        error: `เกิดข้อผิดพลาดภายในระบบเซิร์ฟเวอร์: ${error.message || error}`
      });
    }
  });

  // API Route: Sync data to Google Sheets
  app.post("/api/sheets/sync", async (req, res) => {
    try {
      const { spreadsheetId, ingredients } = req.body;
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "ยังไม่ได้เข้าสู่ระบบ Google หรือเซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง"
        });
      }

      const token = authHeader.substring(7);
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: token });

      const sheets = google.sheets({ version: "v4", auth: oauth2Client });

      let targetId = spreadsheetId;
      let isNew = false;
      const defaultTitle = "Smart Yield Pro - ข้อมูลผลผลิตและต้นทุนวัตถุดิบ";

      // If no spreadsheet ID is provided, create a new one
      if (!targetId) {
        const spreadsheet = await sheets.spreadsheets.create({
          requestBody: {
            properties: {
              title: defaultTitle
            }
          }
        });
        targetId = spreadsheet.data.spreadsheetId || "";
        isNew = true;
      }

      // Get spreadsheet metadata to get the actual sheet name (prevent hardcoded Sheet1 errors)
      const meta = await sheets.spreadsheets.get({ spreadsheetId: targetId });
      const sheetName = meta.data.sheets?.[0]?.properties?.title || "Sheet1";
      const sheetId = meta.data.sheets?.[0]?.properties?.sheetId || 0;

      const headers = [
        "วันที่บันทึก",
        "ชื่อวัตถุดิบ",
        "หมวดหมู่",
        "น้ำหนักดิบ (กก.)",
        "น้ำหนักสุทธิ (กก.)",
        "อัตราผลผลิต (%)",
        "ปริมาณสูญเสีย (กก.)",
        "มูลค่าสูญเสีย (บาท)",
        "ราคาซื้อรวม (บาท)",
        "ต้นทุนจริง/กก. (บาท)",
        "หมายเหตุ/บันทึกเพิ่มเติม"
      ];

      const SERVER_CATEGORIES = [
        { id: "meat", name: "เนื้อสัตว์" },
        { id: "seafood", name: "อาหารทะเล" },
        { id: "vegetables", name: "ผักสด" },
        { id: "fruits", name: "ผลไม้" },
        { id: "bakery", name: "เบเกอรี่ & นม" },
        { id: "dry", name: "ของแห้ง/เครื่องปรุง" },
        { id: "other", name: "อื่นๆ" }
      ];

      const rows = [headers];

      for (const ing of ingredients) {
        const gross = Number(ing.grossWeight) || 0;
        const net = Number(ing.netWeight) || 0;
        const price = Number(ing.totalPurchasePrice) || 0;
        
        const yieldPct = gross > 0 ? (net / gross) * 100 : 0;
        const lossWeight = Math.max(0, gross - net);
        const actualCostPerKg = net > 0 ? price / net : 0;
        const lossValue = gross > 0 ? (lossWeight / gross) * price : 0;

        const catObj = SERVER_CATEGORIES.find(c => c.id === ing.category);
        const categoryLabel = catObj ? catObj.name : ing.category || "อื่นๆ";

        rows.push([
          ing.date || "",
          ing.name || "",
          categoryLabel,
          gross,
          net,
          Number(yieldPct.toFixed(2)),
          Number(lossWeight.toFixed(2)),
          Number(lossValue.toFixed(2)),
          price,
          Number(actualCostPerKg.toFixed(2)),
          ing.notes || ""
        ]);
      }

      // 1. Clear existing rows first (safe, up to Z10000)
      await sheets.spreadsheets.values.clear({
        spreadsheetId: targetId,
        range: `${sheetName}!A1:Z10000`
      });

      // 2. Write new values starting at A1
      await sheets.spreadsheets.values.update({
        spreadsheetId: targetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: rows
        }
      });

      // 3. Format sheet (Make headers beautiful, format currency & number columns, enable gridlines, auto-resize)
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: targetId,
          requestBody: {
            requests: [
              // Style headers A1:K1
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: 11
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 15/255, green: 23/255, blue: 42/255 }, // slate-900
                      textFormat: {
                        foregroundColor: { red: 1, green: 1, blue: 1 },
                        bold: true,
                        fontSize: 10
                      },
                      horizontalAlignment: "CENTER",
                      verticalAlignment: "MIDDLE"
                    }
                  },
                  fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
                }
              },
              // Align numeric values RIGHT, and style them
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: 1,
                    startColumnIndex: 3,
                    endColumnIndex: 10
                  },
                  cell: {
                    userEnteredFormat: {
                      numberFormat: {
                        type: "NUMBER",
                        pattern: "#,##0.00"
                      },
                      horizontalAlignment: "RIGHT"
                    }
                  },
                  fields: "userEnteredFormat(numberFormat,horizontalAlignment)"
                }
              },
              // Enable Gridlines (hideGridlines: false means visible)
              {
                updateSheetProperties: {
                  properties: {
                    sheetId,
                    gridProperties: {
                      hideGridlines: false
                    }
                  },
                  fields: "gridProperties.hideGridlines"
                }
              },
              // Auto-fit Column Widths
              {
                autoResizeDimensions: {
                  dimensions: {
                    sheetId,
                    dimension: "COLUMNS",
                    startIndex: 0,
                    endIndex: 11
                  }
                }
              }
            ]
          }
        });
      } catch (formatErr) {
        console.warn("Failed to format Google Sheet", formatErr);
      }

      return res.status(200).json({
        success: true,
        spreadsheetId: targetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${targetId}/edit`,
        title: meta.data.properties?.title || defaultTitle,
        isNew
      });
    } catch (error: any) {
      console.error("Error syncing with Google Sheets:", error);
      const errorStr = String(error.message || error);
      const isAuthError = error.status === 401 || 
                          error.response?.status === 401 || 
                          errorStr.includes("invalid authentication credentials") || 
                          errorStr.includes("auth") || 
                          errorStr.includes("credentials") || 
                          errorStr.includes("401");
      
      const statusCode = isAuthError ? 401 : 500;
      return res.status(statusCode).json({
        success: false,
        error: isAuthError 
          ? "เซสชัน Google ของคุณหมดอายุ หรือสิทธิ์การเข้าถึงสเปรดชีตไม่ถูกต้อง กรุณาลงชื่อเข้าใช้อีกครั้งเพื่อเชื่อมต่อบัญชีใหม่"
          : `เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets: ${error.message || error}`
      });
    }
  });

  // Vite integration for asset rendering & API fallbacks
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Full-Stack Server] listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
