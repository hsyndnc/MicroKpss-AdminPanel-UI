# Backend: DELETE /api/v1/admin/questions/{id} Endpoint Spec

## Endpoint
```
DELETE /api/v1/admin/questions/{id}
```

## Amaç
Onaylı (Active) status'lu soruyu veritabanından kalıcı olarak sil.

## Authentication
- **Gerekli**: Bearer token (JWT, HttpOnly cookie'den gelen)
- **Rol**: Admin (non-admin kullanıcı 403 Forbidden döner)

## Request
```
DELETE /api/v1/admin/questions/511dd6da-6b34-4976-b8cd-de229c44bf04 HTTP/1.1
Authorization: Bearer {accessToken}
Content-Type: application/json
```

## Response Codes

### 200 OK (Başarı)
```
HTTP/1.1 200 OK
Content-Length: 0
```
Body boş, soru silindi.

### 204 No Content (Alternatif — daha uygun)
```
HTTP/1.1 204 No Content
```

### 404 Not Found
```json
{
  "type": "EntityNotFound",
  "message": "Question not found",
  "id": "511dd6da-6b34-4976-b8cd-de229c44bf04"
}
```

### 403 Forbidden
```json
{
  "type": "UnauthorizedAction",
  "message": "Only admins can delete questions"
}
```

### 401 Unauthorized
```json
{
  "type": "Unauthenticated",
  "message": "Invalid or expired token"
}
```

### 500 Internal Server Error
```json
{
  "type": "InternalServerError",
  "message": "Failed to delete question",
  "traceId": "0HN4..."
}
```

## Iş Kuralları
1. **Silme kısıtlaması**: Sadece `Active` status'lu sorular silinebilir (opsiyonel kural)
   - Alternatif: Tüm status'lar silinebilir
   - Frontend şu anda sadece `Active` sorular için Delete butonu gösteriyor

2. **Cascade delete**: Silme sırasında cascade işlemler
   - Sorunun tüm AI validation kayıtlarını sil
   - Sorunun tüm raporlarını sil (FlaggedForReview varsa)
   - Sorunun source text'ini sil

3. **Audit log**: (Opsiyonel) Admin tarihçesi
   - Admin tarafından silinmiş soruyu log et (silinme tarihi, soru ID, admin user ID)

## Veritabanı İşlemi (Örnek — C#/.NET)
```csharp
[Authorize(Roles = "Admin")]
[HttpDelete("/api/v1/admin/questions/{id}")]
public async Task<IActionResult> DeleteQuestion(Guid id)
{
    var question = await _db.Questions.FindAsync(id);
    if (question == null)
        return NotFound(new { type = "EntityNotFound", message = "Question not found" });
    
    // Cascade delete
    _db.QuestionVerifications.RemoveRange(
        _db.QuestionVerifications.Where(q => q.QuestionId == id)
    );
    _db.QuestionReports.RemoveRange(
        _db.QuestionReports.Where(q => q.QuestionId == id)
    );
    _db.Questions.Remove(question);
    
    await _db.SaveChangesAsync();
    return Ok(); // ya da NoContent()
}
```

## Frontend Entegrasyon
- Frontend `lib/api/questions.ts:44` → `deleteQuestion(id)` 
- Çağrı: `DELETE /api/backend/api/v1/admin/questions/{id}`
- Proxy: `app/api/backend/[...path]/route.ts` → Backend'e yönlendiriyor
- UI: List ve Detail sayfalarında Delete button (sadece Active sorular için)

## Test Adımları
1. Admin olarak login et
2. Soruları listele → Status="Aktif" (Active) filtrele
3. Liste sayfasında "Sil" butonuna tıkla → Confirmation dialog açılsın
4. "Sil" onayı → DELETE isteği gitssin → 200/204 OK dönsün
5. Soru listeden silinmiş olsun

---
**Yazılan**: 2026-09-22  
**Panel Versiyonu**: v0.1.0 (Next.js 16, React 19)  
**Backend Beklenen**: .NET/C# (Kestrel server, port 5213)
