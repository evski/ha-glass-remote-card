// HAClient.swift - minimal Home Assistant REST client (states + services).
// GET /api/states/<entity_id>
// POST /api/services/<domain>/<service>
// Auth: "Authorization: Bearer <long-lived token>".
// 2026-10-11

import Foundation

enum HAError: LocalizedError {
    case notConfigured
    case badURL
    case http(Int)
    case badResponse

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Set HA URL and token"
        case .badURL: return "Bad HA URL"
        case .http(401): return "Token rejected (401)"
        case .http(let code): return "HA error \(code)"
        case .badResponse: return "Bad reply from HA"
        }
    }
}

struct HAClient {
    let baseURL: URL
    let token: String

    /// Accepts "https://host", "https://host/", "host:8123" etc.
    static func normalise(_ raw: String) -> URL? {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty else { return nil }
        if !s.lowercased().hasPrefix("http://") && !s.lowercased().hasPrefix("https://") {
            s = "https://" + s
        }
        while s.hasSuffix("/") { s.removeLast() }
        guard let url = URL(string: s), url.host != nil else { return nil }
        return url
    }

    private static let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 6
        cfg.timeoutIntervalForResource = 10
        cfg.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: cfg)
    }()

    private func request(_ path: String, method: String = "GET", body: [String: Any]? = nil) throws -> URLRequest {
        guard let url = URL(string: baseURL.absoluteString + path) else { throw HAError.badURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        return req
    }

    private func send(_ req: URLRequest) async throws -> Data {
        let (data, response) = try await Self.session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw HAError.badResponse }
        guard (200..<300).contains(http.statusCode) else { throw HAError.http(http.statusCode) }
        return data
    }

    func state(_ entityId: String) async throws -> EntityState {
        let data = try await send(try request("/api/states/\(entityId)"))
        let json = try JSONSerialization.jsonObject(with: data)
        guard let s = EntityState(json: json) else { throw HAError.badResponse }
        return s
    }

    func call(_ domain: String, _ service: String, _ data: [String: Any] = [:]) async throws {
        _ = try await send(try request("/api/services/\(domain)/\(service)", method: "POST", body: data))
    }

    /// entity_picture is usually a relative /api/media_player_proxy/... path with
    /// its own access token in the query, so no auth header is needed to load it.
    func absoluteURL(for path: String) -> URL? {
        if path.hasPrefix("http://") || path.hasPrefix("https://") { return URL(string: path) }
        return URL(string: baseURL.absoluteString + (path.hasPrefix("/") ? path : "/" + path))
    }
}
