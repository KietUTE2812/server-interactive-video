export default function getGrokAPI() {
  const url = "https://api.x.ai/v1/chat/completions";
  return {
    get: async (params) => {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROK_API}`,
        },
        params: params,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    post: async (data) => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROK_API}`,
        },
        body: JSON.stringify({
          model: "grok-3-beta",
          messages: data,
          max_tokens: 500,
          temperature: 0.3,
        }),
      });
      console.log("Response from Grok API:", response);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  };
}
