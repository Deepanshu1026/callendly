const supabase = require('../config/database');

exports.suggestAvailability = async (req, res) => {
  try {
    const { requestText } = req.body;
    const apiKey = process.env.SARVAM_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'SARVAM_API_KEY is missing in environment' });
    }

    const prompt = `Based on the following request text from a client, extract the preferred day, time ranges, and meeting purpose. Suggest a professional response and recommend scheduling slots. Output as JSON format: { "day": "...", "timeRange": "...", "suggestedResponse": "...", "purpose": "..." }. Request: "${requestText}"`;

    try {
      const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: 'sarvam-2b',
          messages: [
            { role: 'system', content: 'You are an expert scheduling AI. Respond strictly in valid JSON.' },
            { role: 'user', content: prompt }
          ]
        })
      });

      const data = await response.json();
      if (response.ok && data.choices?.[0]?.message?.content) {
        let content = data.choices[0].message.content.trim();
        if (content.startsWith('```json')) {
          content = content.substring(7, content.length - 3);
        } else if (content.startsWith('```')) {
          content = content.substring(3, content.length - 3);
        }
        return res.json(JSON.parse(content));
      }
    } catch (apiErr) {
      console.error('Sarvam AI request failed, returning fallback:', apiErr);
    }

    res.json({
      day: 'Monday or Thursday',
      timeRange: '2:00 PM - 5:00 PM',
      purpose: 'General Consultation',
      suggestedResponse: 'Hi, I would be happy to meet with you. Please select a time slot on my booking page that suits you best!'
    });
  } catch (error) {
    console.error('AI Suggest availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.summarizeMeeting = async (req, res) => {
  try {
    const { guestName, guestNotes, eventTitle } = req.body;
    const apiKey = process.env.SARVAM_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'SARVAM_API_KEY is missing in environment' });
    }

    const prompt = `Generate a brief meeting prep summary and 3 recommended questions for a "${eventTitle}" meeting with ${guestName}. Guest notes: "${guestNotes || 'None'}". Output as JSON: { "summary": "...", "questions": ["...", "...", "..."] }`;

    try {
      const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: 'sarvam-2b',
          messages: [
            { role: 'system', content: 'You are an AI calendar assistant. Respond strictly in valid JSON.' },
            { role: 'user', content: prompt }
          ]
        })
      });

      const data = await response.json();
      if (response.ok && data.choices?.[0]?.message?.content) {
        let content = data.choices[0].message.content.trim();
        if (content.startsWith('```json')) {
          content = content.substring(7, content.length - 3);
        } else if (content.startsWith('```')) {
          content = content.substring(3, content.length - 3);
        }
        return res.json(JSON.parse(content));
      }
    } catch (apiErr) {
      console.error('Sarvam AI meeting summary failed, returning fallback:', apiErr);
    }

    res.json({
      summary: `Prep for ${eventTitle} with ${guestName}. Discuss client goals and clarify scheduling buffers.`,
      questions: [
        'What are the primary goals you would like to achieve in this session?',
        'Are there any specific bottlenecks in your current scheduling setup?',
        'Do you require custom booking questions or payment integrations?'
      ]
    });
  } catch (error) {
    console.error('AI Summarize meeting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
