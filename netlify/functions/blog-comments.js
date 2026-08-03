// Blog comments — CRUD for comment moderation and display
// GET with ?slug=post-slug: returns approved comments only
// GET with ?slug=post-slug&all=true: returns all comments including pending (admin)
// POST: creates new comment (name, email, comment, slug, parentId optional)
// DELETE with ?id=comment-id&slug=post-slug: deletes a comment (admin)
// PATCH/PUT with ?id=comment-id&slug=post-slug&action=approve: approves a comment

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  const store = getStore({ name: "blog-comments", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

  try {
    if (event.httpMethod === "GET") {
      const { slug, all } = event.queryStringParameters || {};

      if (!slug) {
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ error: "Missing slug parameter" })
        };
      }

      let comments = [];
      try {
        const key = `comments-${slug}`;
        const existing = await store.get(key, { type: "json" });
        if (existing) {
          comments = existing;
        }
      } catch (e) {
        /* no comments yet */
      }

      // Filter to approved comments unless all=true (admin view)
      const filtered = all === "true" ? comments : comments.filter(c => c.status === "approved");

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ comments: filtered })
      };
    }

    if (event.httpMethod === "POST") {
      const data = JSON.parse(event.body);
      const { name, email, comment, slug, parentId } = data;

      if (!name || !email || !comment || !slug) {
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ error: "Missing required fields: name, email, comment, slug" })
        };
      }

      // Create new comment object
      const newComment = {
        id: generateId(),
        slug: slug,
        name: name,
        email: email,
        comment: comment,
        parentId: parentId || null,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      // Load existing comments for this slug
      let comments = [];
      try {
        const key = `comments-${slug}`;
        const existing = await store.get(key, { type: "json" });
        if (existing) {
          comments = existing;
        }
      } catch (e) {
        /* no comments yet */
      }

      // Add new comment
      comments.push(newComment);

      // Save back to store
      const key = `comments-${slug}`;
      await store.setJSON(key, comments);

      return {
        statusCode: 201,
        headers: corsHeaders(),
        body: JSON.stringify({ success: true, id: newComment.id, message: "Comment submitted for moderation" })
      };
    }

    if (event.httpMethod === "DELETE") {
      const { id, slug } = event.queryStringParameters || {};

      if (!id || !slug) {
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ error: "Missing id or slug parameter" })
        };
      }

      // Load existing comments
      let comments = [];
      try {
        const key = `comments-${slug}`;
        const existing = await store.get(key, { type: "json" });
        if (existing) {
          comments = existing;
        }
      } catch (e) {
        /* no comments yet */
      }

      // Filter out the comment to delete
      const filtered = comments.filter(c => c.id !== id);

      if (filtered.length === comments.length) {
        return {
          statusCode: 404,
          headers: corsHeaders(),
          body: JSON.stringify({ error: "Comment not found" })
        };
      }

      // Save updated comments
      const key = `comments-${slug}`;
      await store.setJSON(key, filtered);

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ success: true, message: "Comment deleted" })
      };
    }

    if (event.httpMethod === "PATCH" || event.httpMethod === "PUT") {
      const { id, slug, action } = event.queryStringParameters || {};

      if (!id || !slug) {
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ error: "Missing id or slug parameter" })
        };
      }

      if (action === "approve") {
        // Load existing comments
        let comments = [];
        try {
          const key = `comments-${slug}`;
          const existing = await store.get(key, { type: "json" });
          if (existing) {
            comments = existing;
          }
        } catch (e) {
          /* no comments yet */
        }

        // Find and approve the comment
        const comment = comments.find(c => c.id === id);
        if (!comment) {
          return {
            statusCode: 404,
            headers: corsHeaders(),
            body: JSON.stringify({ error: "Comment not found" })
          };
        }

        comment.status = "approved";

        // Save updated comments
        const key = `comments-${slug}`;
        await store.setJSON(key, comments);

        return {
          statusCode: 200,
          headers: corsHeaders(),
          body: JSON.stringify({ success: true, message: "Comment approved" })
        };
      }

      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Unknown action" })
      };
    }

    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    console.error("Blog comments error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to process comments" })
    };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, PATCH, PUT, OPTIONS",
    "Content-Type": "application/json"
  };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
