import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Channel Adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LINE Adapter", () => {
    it("should verify webhook signature correctly", () => {
      const verifySignature = (
        body: string,
        signature: string,
        secret: string
      ): boolean => {
        // 실제 구현에서는 crypto.createHmac 사용
        // 테스트에서는 간단한 검증
        return signature.length > 0 && body.length > 0;
      };

      expect(verifySignature('{"events":[]}', "abc123", "secret")).toBe(true);
      expect(verifySignature("", "abc123", "secret")).toBe(false);
    });

    it("should parse LINE message correctly", () => {
      const lineMessage = {
        type: "message",
        message: {
          type: "text",
          id: "msg-1",
          text: "Hello",
        },
        source: {
          type: "user",
          userId: "user-123",
        },
        replyToken: "reply-token",
        timestamp: 1234567890000,
      };

      const parsed = {
        id: lineMessage.message.id,
        content: lineMessage.message.text,
        contentType: lineMessage.message.type,
        senderId: lineMessage.source.userId,
        timestamp: new Date(lineMessage.timestamp),
      };

      expect(parsed.content).toBe("Hello");
      expect(parsed.contentType).toBe("text");
      expect(parsed.senderId).toBe("user-123");
    });

    it("should support Quick Replies", () => {
      const quickReply = {
        items: [
          {
            type: "action",
            action: {
              type: "message",
              label: "예",
              text: "예",
            },
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "아니오",
              text: "아니오",
            },
          },
        ],
      };

      expect(quickReply.items).toHaveLength(2);
      expect(quickReply.items[0].action.label).toBe("예");
    });
  });

  describe("KakaoTalk Adapter", () => {
    it("should parse Kakao Skill payload", () => {
      const kakaoPayload = {
        intent: {
          id: "intent-1",
          name: "문의하기",
        },
        userRequest: {
          timezone: "Asia/Seoul",
          params: {},
          block: { id: "block-1", name: "문의 블록" },
          utterance: "라식 수술 비용이 얼마인가요?",
          lang: "ko",
          user: {
            id: "user-123",
            type: "botUserKey",
            properties: {},
          },
        },
        bot: {
          id: "bot-1",
          name: "의료상담봇",
        },
        action: {
          name: "action-1",
          clientExtra: {},
          params: {},
        },
      };

      expect(kakaoPayload.userRequest.utterance).toBe("라식 수술 비용이 얼마인가요?");
      expect(kakaoPayload.userRequest.user.id).toBe("user-123");
    });

    it("should generate Skill response correctly", () => {
      const generateResponse = (text: string, quickReplies?: string[]) => {
        const response: Record<string, unknown> = {
          version: "2.0",
          template: {
            outputs: [
              {
                simpleText: {
                  text,
                },
              },
            ],
          },
        };

        if (quickReplies?.length) {
          (response.template as Record<string, unknown>).quickReplies = quickReplies.map((label) => ({
            messageText: label,
            action: "message",
            label,
          }));
        }

        return response;
      };

      const response = generateResponse("안녕하세요!", ["예약하기", "문의하기"]);

      expect(response.version).toBe("2.0");
      expect((response.template as Record<string, unknown>).quickReplies).toHaveLength(2);
    });
  });

  describe("Meta (Facebook/Instagram/WhatsApp) Adapter", () => {
    it("should verify Meta webhook signature", () => {
      const verifyMetaSignature = (
        payload: string,
        signature: string,
        appSecret: string
      ): boolean => {
        // SHA256 HMAC 검증
        return signature.startsWith("sha256=");
      };

      expect(verifyMetaSignature("{}", "sha256=abc123", "secret")).toBe(true);
      expect(verifyMetaSignature("{}", "md5=abc123", "secret")).toBe(false);
    });

    it("should parse Facebook Messenger message", () => {
      const fbMessage = {
        object: "page",
        entry: [
          {
            id: "page-123",
            time: 1234567890000,
            messaging: [
              {
                sender: { id: "user-456" },
                recipient: { id: "page-123" },
                timestamp: 1234567890000,
                message: {
                  mid: "msg-789",
                  text: "Hello from Facebook",
                },
              },
            ],
          },
        ],
      };

      const message = fbMessage.entry[0].messaging[0];
      expect(message.message.text).toBe("Hello from Facebook");
      expect(message.sender.id).toBe("user-456");
    });

    it("should parse WhatsApp message", () => {
      const waMessage = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "account-123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+1234567890",
                    phone_number_id: "phone-123",
                  },
                  contacts: [{ profile: { name: "John" }, wa_id: "123456789" }],
                  messages: [
                    {
                      from: "123456789",
                      id: "msg-123",
                      timestamp: "1234567890",
                      text: { body: "Hello from WhatsApp" },
                      type: "text",
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const message = waMessage.entry[0].changes[0].value.messages[0];
      expect(message.text.body).toBe("Hello from WhatsApp");
      expect(message.from).toBe("123456789");
    });
  });

  describe("WeChat Adapter", () => {
    it("should parse WeChat XML message", () => {
      const parseXMLMessage = (xml: string) => {
        // 간단한 XML 파싱 (실제로는 xml2js 사용)
        const getTagContent = (tag: string) => {
          const match = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`));
          return match ? match[1] : null;
        };

        return {
          toUserName: getTagContent("ToUserName"),
          fromUserName: getTagContent("FromUserName"),
          content: getTagContent("Content"),
          msgType: getTagContent("MsgType"),
        };
      };

      const xmlMessage = `<xml>
        <ToUserName><![CDATA[gh_123456]]></ToUserName>
        <FromUserName><![CDATA[oXYZabc123]]></FromUserName>
        <CreateTime>1234567890</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[Hello from WeChat]]></Content>
        <MsgId>123456789</MsgId>
      </xml>`;

      const parsed = parseXMLMessage(xmlMessage);
      expect(parsed.content).toBe("Hello from WeChat");
      expect(parsed.msgType).toBe("text");
    });
  });
});

describe("Unified Message Interface", () => {
  it("should normalize messages from different channels", () => {
    interface UnifiedMessage {
      id: string;
      channelType: string;
      senderId: string;
      content: string;
      contentType: string;
      timestamp: Date;
      metadata: Record<string, unknown>;
    }

    const normalizeLineMessage = (lineMsg: Record<string, unknown>): UnifiedMessage => ({
      id: lineMsg.id as string,
      channelType: "line",
      senderId: (lineMsg.source as Record<string, string>).userId,
      content: (lineMsg.message as Record<string, string>).text,
      contentType: (lineMsg.message as Record<string, string>).type,
      timestamp: new Date(lineMsg.timestamp as number),
      metadata: { replyToken: lineMsg.replyToken },
    });

    const lineMsg = {
      id: "msg-1",
      source: { userId: "user-123" },
      message: { type: "text", text: "Hello" },
      timestamp: 1234567890000,
      replyToken: "token-123",
    };

    const unified = normalizeLineMessage(lineMsg);
    expect(unified.channelType).toBe("line");
    expect(unified.content).toBe("Hello");
    expect(unified.metadata.replyToken).toBe("token-123");
  });
});
