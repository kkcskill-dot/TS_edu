let API_BASE = '/tssurvey/api';
// 로컬 파일 열기(file://)이거나 로컬호스트 접근 시 127.0.0.1:8091 백엔드 직접 호출
if (window.location.protocol === 'file:' || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    API_BASE = 'http://127.0.0.1:8091';
}

const suvApi = {
    async getTopics() {
        const res = await fetch(`${API_BASE}/topics`);
        if (!res.ok) throw new Error('Failed to fetch topics');
        return res.json();
    },

    async createTopic(title) {
        const res = await fetch(`${API_BASE}/topics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        if (!res.ok) throw new Error('Failed to create topic');
        return res.json();
    },

    async getResponses(topicId) {
        const res = await fetch(`${API_BASE}/responses?topic_id=${encodeURIComponent(topicId)}`);
        if (!res.ok) throw new Error('Failed to fetch responses');
        return res.json();
    },

    async submitResponse(topicId, starRating, comment) {
        const res = await fetch(`${API_BASE}/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic_id: topicId, star_rating: starRating, comment })
        });
        if (!res.ok) throw new Error('Failed to submit response');
        return res.json();
    }
};
