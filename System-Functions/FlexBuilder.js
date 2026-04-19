/**
 * core/FlexBuilder.js - Paperclip AI [EXCLUSIVELY PREMIUM]
 * Professional UI/UX Design System for LINE Flex Messages.
 */

class FlexBuilder {
    /**
     * Professional Status Dashboard Flex.
     */
    buildStatusBoard(stats) {
        return {
            type: "flex",
            altText: "📊 PAPERCLIP SYSTEM STATUS",
            contents: {
                type: "bubble",
                backgroundColor: "#0F172A",
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: "TRADING SYSTEM STATUS", weight: "bold", color: "#60A5FA", size: "xs", letterSpacing: "2px" },
                        { type: "text", text: "ACTIVE MONITOR", weight: "bold", size: "xl", color: "#FFFFFF", margin: "sm" },
                        {
                            type: "box",
                            layout: "vertical",
                            margin: "lg",
                            spacing: "sm",
                            contents: [
                                this.createStatusRow("AI Brains Online", `${stats.activeKeys} Active`, "#10B981"),
                                this.createStatusRow("Market Scans", stats.missions, "#FFFFFF"),
                                this.createStatusRow("System Memory", `${stats.memory}MB`, "#F59E0B"),
                                this.createStatusRow("Risk Guard", "ACTIVE ✅", "#60A5FA")
                            ]
                        }
                    ]
                }
            }
        };
    }

    createStatusRow(label, value, valueColor) {
        return {
            type: "box",
            layout: "horizontal",
            contents: [
                { type: "text", text: label, color: "#94A3B8", size: "sm" },
                { type: "text", text: value, color: valueColor, size: "sm", weight: "bold", align: "end" }
            ]
        };
    }
}

module.exports = new FlexBuilder();
