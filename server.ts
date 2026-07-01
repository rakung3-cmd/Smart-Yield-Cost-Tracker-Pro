import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables from .env
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parser is crucial for incoming POST payloads
  app.use(express.json());

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
      const to = (recipientId || process.env.LINE_RECIPIENT_ID || process.env.LINE_GROUP_ID || "").trim();

      if (!token) {
        return res.status(400).json({
          success: false,
          error: "กรุณากำหนด LINE Channel Access Token ในส่วนการตั้งค่า หรือในไฟล์ .env ก่อนใช้งาน"
        });
      }

      if (!to) {
        return res.status(400).json({
          success: false,
          error: "กรุณากำหนด ID ผู้รับ (User ID, Group ID หรือ Room ID) ของ LINE ก่อนใช้งาน"
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
              "size": "xs",
              "textDecoration": "none"
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
                      align: "right",
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
                      align: "right",
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
                      align: "right",
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
                      align: "right",
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

      // Call LINE Messaging API - Push Message
      const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          to: to,
          messages: [
            {
              type: "flex",
              altText: `รายงานสรุปผลผลิตและต้นทุนวัตถุดิบอาหาร - Smart Yield Pro (Yield: ${avgYieldText}, Loss: ${totalLossValueText})`,
              contents: flexBubble
            }
          ]
        })
      });

      if (!lineResponse.ok) {
        const errText = await lineResponse.text();
        console.error("LINE Messaging API responded with error:", errText);
        return res.status(lineResponse.status).json({
          success: false,
          error: `LINE API Error: ${errText || lineResponse.statusText}`
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
