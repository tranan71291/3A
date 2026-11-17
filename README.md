# 3A CRM v37 (Tổng quan điều hành + chỉ tiêu KPI, AI Content Studio đa kênh, Copilot dạng Skill — dựa trên v36)

## Cài đặt / nâng cấp từ v36
```bash
npm i @supabase/supabase-js      # mới: Copilot đọc dữ liệu bằng phiên đăng nhập người dùng
# chép đè thư mục src/ và scripts/ vào dự án (src/lib/ai, src/app/api/chat là thư mục mới)
npm run build
```
- `package.json` › `scripts`: thêm `"prebuild": "node scripts/gen-skill-index.mjs"` (sinh lại danh sách Skill khi thêm / bớt Skill; gói đã kèm sẵn `src/lib/ai/skills/_generated.ts`).
- `tsconfig.json`: cần alias `"@/*": ["./src/*"]` (mặc định của create-next-app có thư mục src).
- Supabase SQL Editor, chạy theo thứ tự (chạy lại nhiều lần vẫn an toàn): `supabase-v37.sql` (quyền ghi chỉ tiêu KPI) và `ai-copilot.sql` (bật extension vector trước; kho tài liệu RAG + nhật ký tool).
- Biến môi trường mới (tùy chọn): `EMBEDDING_MODEL` (để trống = text-embedding-3-small), `COMPANY_NAME` (tên trong prompt Copilot).
- Dữ liệu: DATA_VERSION 28 chỉ thêm nhóm `kpiTargets`. Không đổi dữ liệu cũ, không đổi API cũ.

## Điểm mới v37

### Tổng quan điều hành (4 tab)
- Tab Tổng Quan · Kinh doanh · Marketing · Tài chính (+ Xưởng & công trình khi có mô hình xưởng). Thanh lọc: Tuần / Tháng / Quý / Năm, so với kỳ trước, phòng ban, kỳ vọng tiến độ theo thời gian, In / PDF.
- Thẻ KPI: số chính, so kỳ trước, thanh tiến độ có vạch kỳ vọng, trạng thái Đạt / Theo dõi / Chậm. Doanh thu, Pipeline (độ phủ phần còn thiếu), Tỷ lệ chốt, Lead, Quỹ Hãng, Công nợ, Chu kỳ chốt, Tiền thu, Chờ Hãng hoàn.
- Biểu đồ doanh thu 12 tháng so chỉ tiêu + dự báo; Cần duyệt; phễu bán hàng; doanh số phòng ban có vạch chỉ tiêu; Sắp chốt; Lý do trượt; Chỉ tiêu nhân viên; Rủi ro SLA; Lead theo tuần theo kênh; phễu data MKT; hiệu quả theo kênh; dòng tiền quỹ Hãng; claim sắp hạn; thu chi 6 tháng; khách vượt hạn mức.
- Trưởng phòng chỉ xem phòng mình, nhân viên kinh doanh xem số của mình. Bảng điều khiển kéo-thả cũ không còn ở Tổng quan.

### Chỉ tiêu KPI (nút "Chỉ tiêu")
- Giám đốc nhập chỉ tiêu tháng cho phòng ban (doanh thu, lead, số dự án chốt) và ngưỡng đánh giá (tỷ lệ chốt, chu kỳ chốt, độ phủ pipeline, chi phí / lead).
- Trưởng phòng nhập chỉ tiêu nhân viên phòng mình (không tự giao cho mình); Giám đốc sửa được. Hiện tổng chỉ tiêu nhân viên so với chỉ tiêu phòng. "Chép từ tháng trước".
- Kiểm quyền 2 lớp: giao diện + RLS máy chủ (`supabase-v37.sql`, kiểm theo mã bản ghi). Mọi lần lưu ghi nhật ký bảo mật.

### AI Content Studio (Marketing Hub › Content Studio)
- "Nội dung mới" mở Studio toàn khung 4 bước: Cài đặt kênh → Dàn ý (kéo thả, H2/H3) → Viết & ảnh (split-view: dàn ý | nội dung | điểm SEO) → Hoàn thiện (bản xuất bản theo kênh, sao chép HTML / bài).
- Kênh: Website (focus / LSI keyword, meta title ≤ 60, meta description ≤ 155, slug), Facebook, Zalo OA (hook AIDA / PAS, CTA, hashtag, không H2/H3), Google Maps (Cập nhật / Sự kiện / Ưu đãi, 100 ký tự đầu, NAP). Thêm kênh = thêm 1 hằng PlatformStrategy.
- Ảnh từng mục: ảnh tham chiếu (img2img) + Image Strength 0–1, màu thương hiệu, watermark tên doanh nghiệp. OpenAI không có denoising strength thật: thanh trượt đổi thành chỉ dẫn prompt + input_fidelity cao khi ≤ 0,35.
- Tự lưu nháp 1,5 giây sau thay đổi, Hoàn tác thao tác cấu trúc, Gửi duyệt / Duyệt / Đã đăng như trước. Bài ZNS, email báo giá, tin chăm sóc vẫn mở trình soạn cũ. Chưa kết nối AI: dùng dàn ý / đoạn mẫu và ảnh mẫu.

### AI Copilot dạng Skill
- Có máy chủ Supabase: khung AI Copilot gọi `/api/chat`; AI tự gọi công cụ (Skill MDF, pipeline) đọc dữ liệu bằng phiên đăng nhập của chính người hỏi (RLS, không dùng service role), kèm số liệu tóm tắt trong phạm vi quyền. Chưa cài route / thiếu khóa: tự quay về cách v36.
- Thêm Skill = thêm thư mục `src/lib/ai/skills/<id>/` rồi chạy `node scripts/gen-skill-index.mjs`. Thử nhanh: `scripts/copilot-test.mjs` (xem hướng dẫn thử Copilot).


## Điểm mới v36 — AI Copilot
- Lời chào, cảm ơn, câu xã giao: trả lời 1–2 câu, không chạy bộ phân tích, không gửi số liệu CRM cho AI, không hiện 8 nút gợi ý.
- Câu hỏi nghiệp vụ (quỹ MDF, SLA, dòng tiền, công nợ…): số liệu tính sẵn trong app như cũ; AI trả lời thẳng con số trước, tối đa vài ý; thẻ chi tiết chỉ hiện 3 mục đầu ("Xem thêm" để mở).
- Câu hỏi bộ phân tích không hiểu: AI trả lời tự do trên dữ liệu CRM thay vì "Mình chưa hiểu" + bản tin tổng quan.
- Lịch sử hội thoại 10 lượt gần nhất, không còn chèn số liệu tổng quan vào từng lượt hỏi.
- Câu trả lời hiển thị Markdown (chữ đậm, gạch đầu dòng, danh sách số) thay vì ký tự ** và gạch đầu dòng dính liền; có dấu "đang trả lời" khi chờ AI.
- @AI trong chat nhóm: cùng phong cách, trả lời chữ thường (không ký tự Markdown).
- Chỉ sửa 4 file: lib/core.tsx, lib/types.ts, modules/ai/copilot-plus.tsx, modules/messages/comm-hub.tsx. Không đổi dữ liệu, không đổi API, không cần chạy SQL.


Next.js (App Router) + TypeScript + Tailwind CSS. Tùy chọn Supabase cho nhiều người dùng.

## Cài đặt

```bash
npm i recharts lucide-react
# chép thư mục src/ của gói này đè vào src/ của dự án Next.js
npm run dev        # thử
npm run build      # kiểm tra trước khi triển khai
```

- Dùng Supabase: chạy `supabase-setup.sql` trong Supabase SQL Editor (chạy lại nhiều lần vẫn an toàn), đổi `env.local.example` thành `.env.local` và điền 2 biến. Chỉ dùng khóa anon/publishable, không dùng service_role.
- Không khai báo Supabase: chạy như bản demo, dữ liệu lưu trong trình duyệt.
- Dữ liệu cũ giữ nguyên: DATA_VERSION 24 (22: bảng tin `posts`; 23: danh mục kho `warehouses`, tạo sẵn Kho Tổng và toàn bộ tồn hiện có thuộc Kho Tổng; 24: phiếu kho `stockVouchers`). Chỉ thêm, không đổi số lượng. Mở app là tự nâng cấp; bản app cũ sẽ báo dữ liệu mới hơn và không ghi đè.
- Không cần cài thêm thư viện Excel: đọc / ghi .xlsx bằng mã có sẵn trong `lib/csv.tsx` (dùng DecompressionStream của trình duyệt), tránh gói `xlsx` trên npm (bản 0.18.5 có lỗ hổng đã công bố).
- `supabase-setup.sql` giữ như v26 (bảng tin lưu trong `records`, đã được RLS tách theo doanh nghiệp).

## Cấu trúc thư mục

```
src/
  app/page.tsx                 điểm vào, chỉ import DashboardApp
  crm/
    app/        App.tsx (khung ứng dụng, định tuyến #/<dn>/<module>), context, header, login
    components/ ui (Design System: nút, bảng, tab, badge, toast, drawer...), controls, filters, crud, comments...
    lib/        types.ts (kiểu dữ liệu), core.tsx (hằng số, token màu, cấu hình, dữ liệu khởi tạo, giữ thứ tự gốc),
                business, cloud (Supabase), storage (phiên bản dữ liệu), security, modules, workshop, getfly...
    modules/    dashboard, leads, customers, projects, sales, products, supply, mdf, finance,
                alux (đơn hàng, sản xuất, lắp đặt, vật tư), staff, tasks, docs, reports, settings, messages, platform
single-file/DashboardApp.tsx   cùng mã nguồn ở dạng 1 file (dán vào src/app/page.tsx nếu muốn dùng như v25)
```

Quy ước: hằng số và lớp nằm ở `lib/core.tsx` (giữ đúng thứ tự khởi tạo), các file module chỉ chứa hàm và component. Muốn thêm hằng số mới thì đặt ở `core.tsx` để tránh vòng import lúc khởi tạo.

## Điểm mới v35

### Báo giá thông minh (Smart Quote)
- Phần Hàng hóa của màn Tạo báo giá là bảng tính: gõ thẳng vào dòng trống cuối bảng, Enter / ↑ ↓ di chuyển như Excel, bảng mở rộng 64% màn hình (nút Thu gọn / Mở rộng bảng).
- Dán bảng (Ctrl + V): bôi đen bảng vật tư trong Excel / Word của khách rồi dán vào bảng. Tự nhận cột Tên, Mã hiệu / Quy cách (ghép vào tên), ĐVT, Số lượng, Đơn giá, có hoặc không có dòng tiêu đề; bỏ dòng STT, Tổng cộng, VAT; hiểu số kiểu Việt Nam (1.500 = 1500, 2,5). Dán một cột số vào cột SL / Đơn giá / CK thì điền xuống như Excel. Danh sách chữ dạng "Cáp CV 2.5mm2 - 200 m" cũng tách được.
- Gõ tên hàng tự do: không cần danh mục trước, không báo lỗi. Hàng trùng danh mục tự gắn mã và giá theo bảng giá; hàng đã từng báo tự điền giá bán gần nhất; hàng mới để ô đơn giá màu cam chờ nhập.
- Tự học: khi tạo báo giá, hàng gõ tự do và đơn giá được lưu vào Danh mục nháp (Sản phẩm › Danh mục nháp). Lần sau gõ từ khóa gần đúng sẽ có gợi ý kèm giá bán gần nhất, ngày, khách và mã báo giá. Từ Danh mục nháp có thể "Tạo mã hàng" chính thức.
- Nhập từ ảnh / PDF: AI đọc ảnh chụp, bản scan, viết tay hoặc PDF dự toán, tách Tên hàng - Số lượng - ĐVT (- đơn giá nếu có) rồi thêm vào bảng, dòng có nhãn AI. Claude đọc được ảnh và PDF; OpenAI chỉ đọc ảnh. PDF tối đa 3 MB.
- Hàng nháp chưa có giá vốn nên báo giá có hàng nháp chưa tính được biên gộp và theo quy tắc hiện có sẽ cần Trưởng phòng duyệt giá.

### Bàn làm việc (Social Intranet)
- Bố cục 3 cột: trái là menu bảng tin; giữa là thanh lệnh Trợ lý số + soạn bài + luồng tin nội bộ; phải là widget.
- Thanh lệnh Trợ lý số (phím /): tìm nhanh bài viết, khách hàng, dự án, báo giá (cả theo tên hàng), đồng nghiệp; Enter để hỏi AI về số liệu; gợi ý sẵn (việc chờ, tóm tắt hôm nay, doanh số tháng, rủi ro SLA).
- Bản tin điều hành (Giám đốc) chuyển lên đầu cột phải, dạng thu gọn: thẻ số liệu luôn hiện, "Xem chi tiết" để mở; nút tạo lại / sao chép / đăng Kênh chung dạng icon.
- Widget "Truyền thông VASSH & 3A Group" với 3 tab Fanpage · Zalo OA · YouTube (YouTube có dạng danh sách / lưới). Mỗi thẻ có ảnh, tiêu đề, thời gian, nút Sao chép liên kết và Chia sẻ nhanh (chia sẻ qua ứng dụng trên điện thoại, sao chép kèm lời giới thiệu, gửi qua Zalo Hub, Facebook, email, đăng lên Bảng tin).
- Nguồn bài: YouTube qua RSS công khai (chỉ cần Channel ID); Fanpage qua Graph API (FACEBOOK_PAGE_ACCESS_TOKEN); Zalo OA qua API tin bài (dùng chung kết nối Zalo Hub). Marketing / Giám đốc bấm + để ghim bài, video thủ công (hiển thị cả khi chưa kết nối API). Khai báo kênh ở Cài đặt › AI, Zalo OA & ZNS › Truyền thông đa kênh.
- "Việc của tôi & hiệu suất": việc chờ xử lý, lead mới 7 ngày, báo giá đã tạo và doanh số đã chốt trong tháng.

### Máy chủ & dữ liệu
- Route mới: POST /api/ai/extract, GET /api/social (bắt buộc đăng nhập Supabase, giới hạn tần suất, bộ nhớ đệm 10 phút). Biến môi trường mới xem env.local.example.
- DATA_VERSION 27: thêm nhóm dữ liệu draftProducts (danh mục nháp), socialPosts (bài ghim), cấu hình kênh. Chỉ thêm, không đổi dữ liệu cũ, không cần chạy thêm SQL.

## Điểm mới v34 — Tinh gọn & phân quyền

### Dữ liệu sạch
- Bỏ toàn bộ chức năng nạp dữ liệu mẫu (nút "Nạp dữ liệu mẫu", "Tạo ví dụ luồng bán hàng", "Mô phỏng lead / quá hạn", "Mô phỏng tin đến" ở Zalo Hub), bảng giá và vật tư mẫu của doanh nghiệp xưởng, danh sách tài khoản demo và mật khẩu gợi ý ở màn hình đăng nhập.
- Doanh nghiệp mới bắt đầu trống, chỉ có cấu hình mặc định (phòng ban, nhóm khách, nguồn khách, hạng mục quỹ… đều sửa được).
- Doanh nghiệp còn dữ liệu mẫu từ bản cũ: Cài đặt › Dữ liệu & bảo mật hiện mục "Xóa dữ liệu mẫu" (chỉ xóa bản ghi mã demo-, giữ dữ liệu thật).

### Menu & bố cục
- Menu trái dạng thanh icon gọn, rê chuột vào icon hiện nhãn chức năng (kèm số việc chờ), không còn bung rộng khi rê; Ctrl + B hoặc nút cuối menu để mở rộng có chữ khi cần.
- Sắp xếp nhóm: Không gian làm việc · Kinh doanh · Marketing & Quỹ Hãng · Hàng hóa & Sản xuất · Tài chính · Hệ thống.
- Bỏ phần trùng lặp: nút 9 chấm trên header, nhóm "Hay dùng", các lối tắt trùng menu ở thanh phải (chỉ giữ Chat & AI), nút nổi "Quỹ 3M" luôn hiện (mở lại bằng Ctrl + K › "widget theo dõi quỹ"), KPI trùng ở Thu chi.
- Thanh chọn dạng nút (segmented) thống nhất kiểu nền trắng viền mảnh thay cho khối cam; tab cấp phân hệ (Đơn hàng công trình, Nhập xuất tồn) dùng kiểu gạch chân như các trang khác.

### Cài đặt
- Menu cài đặt chia nhóm: Tổ chức · Nghiệp vụ · Marketing & quỹ · Tích hợp · Hệ thống; các khối mở sẵn, bỏ bước "Mở để chỉnh sửa".
- Gộp "Zalo ZNS" vào "AI, Zalo OA & ZNS": kết nối dùng chung cấu hình máy chủ; phần thông báo hệ thống chọn mẫu ZNS đã khai báo, không còn ô nhập App ID / Secret Key trên trình duyệt.

### Phân quyền chi tiết (Cài đặt › Phân quyền)
- Theo vai trò: chọn vai trò → phạm vi dữ liệu (Toàn doanh nghiệp / Phòng ban / Chỉ của mình / Chỉ đơn đã chốt) → từng phân hệ có công tắc Truy cập và các thao tác bên trong; "Cho phép tất cả / Tắt tất cả" theo nhóm.
- Ngoại lệ từng tài khoản: mỗi quyền chọn Theo vai trò / Cho phép / Chặn, phạm vi dữ liệu riêng; số ngoại lệ hiện cạnh tên, "Xóa mọi ngoại lệ".
- Quyền hiệu lực = ngoại lệ tài khoản › vai trò › mặc định; mọi thay đổi ghi nhật ký bảo mật. Giám đốc luôn giữ quyền Cài đặt.

### Tài khoản của tôi (menu avatar › Tài khoản của tôi)
- Ảnh đại diện (tự thu nhỏ 256px, hiện ở header, bảng tin, tin nhắn, danh bạ, danh sách nhân sự), họ tên, chức danh, điện thoại, ngày sinh, chữ ký email / báo giá, đổi mật khẩu.

Không đổi cấu trúc dữ liệu (DATA_VERSION 26); trường mới đều tùy chọn.

## Điểm mới v33 — Marketing Hub

### AI Content & Visual Studio (thay Content Studio)
Cửa sổ 4 bước: (1) Tiêu đề & phân tích → (2) Dàn ý → (3) Nội dung & hình ảnh → (4) Xem trước & lưu.
- Phân tích tiêu đề: nút "Phân tích" cạnh ô tiêu đề; điểm hấp dẫn, điểm SEO, điểm mạng xã hội kèm nhận xét, gợi ý cải thiện và 3 tiêu đề tối ưu (bấm để thay).
- Dàn ý: AI tách tiêu đề H1 thành các mục H2 / H3 kèm ý chính; khối kéo thả (hoặc nút lên / xuống), sửa, đổi cấp, thêm, xóa; tạo lại dàn ý có Hoàn tác.
- Nội dung: viết từng mục hoặc "Viết các mục còn trống" — AI viết đúng phạm vi từng mục, dễ kiểm soát hơn một đoạn dài.
- Ảnh theo tiểu mục: nút "Tạo ảnh minh họa bằng AI" ở mỗi mục, mô tả ảnh tự lấy từ tiêu đề mục + ý chính + yêu cầu hình ảnh chung (sửa được); ảnh chèn ngay dưới mục; xem lớn, tạo lại, đổi giữa các phương án đã tạo, tải ảnh của mình lên, bỏ ảnh; "Tạo ảnh cho mọi H2".
- Xem trước bài hoàn chỉnh, đếm từ / ảnh, sao chép văn bản, tải HTML kèm ảnh; Lưu nháp → Gửi duyệt → Duyệt → Đã đăng.
- Ảnh tạo qua route `/api/ai/image` (OpenAI Images, OPENAI_IMAGE_MODEL mặc định gpt-image-1); ảnh được thu nhỏ JPEG ≤ 1280px trước khi lưu. Chưa cấu hình: dùng ảnh minh họa mẫu có ghi chú rõ để vẫn chạy được trọn luồng.

### Lịch chiến dịch = Bảng kế hoạch thực thi tích hợp AI
- 3 chế độ xem: Lịch tháng · Danh sách (cột như Excel, xuất Excel) · Bảng (4 cột theo trạng thái).
- Bấm vào một ngày (hoặc "Nhiệm vụ nội dung") mở thẻ nhiệm vụ: tiêu đề, ngày đăng, chiến dịch, kênh phân phối, loại nội dung, yêu cầu nội dung (prompt), yêu cầu hình ảnh / video (prompt), phụ trách, trạng thái.
- "Giao cho AI xử lý" (trong thẻ nhiệm vụ, trên danh sách, và khi tạo / sửa chiến dịch): đẩy prompt sang Content Studio; AI chạy nền lập dàn ý → viết từng mục → tạo ảnh cho các mục H2 → chuyển Chờ duyệt. Có thể đóng cửa sổ, việc vẫn chạy trên phiên của người giao.
- Màu trạng thái tự cập nhật: Kế hoạch (xám) → Chờ AI xử lý (vàng) → AI xong / chờ duyệt (xanh dương) → Đã đăng (xanh lá). Chiến dịch hiển thị bằng thanh mảnh phía trên mỗi ngày.

Dữ liệu nâng lên DATA_VERSION 26 (thêm nhóm mktTasks), không thay đổi dữ liệu cũ.

## Điểm mới v32

### Phần 1 — Zalo Hub (menu trái, nhóm Không gian làm việc)
- 3 cột: danh sách hội thoại (lọc Đang mở / Chưa đọc / Của tôi / Chưa nhận / Đã xong, cảnh báo khách chờ quá X phút) · khung chat (trả lời khách, ghi chú nội bộ, mẫu nhanh, gợi ý trả lời AI, soạn tin chăm sóc) · ngữ cảnh khách hàng / đơn hàng / dự án / báo giá, phụ trách, nhãn, gửi ZNS.
- Tự liên kết hội thoại khi trùng SĐT, khách nhắc mã (KH-, LD-, DH-, BG-, PO-), hoặc trùng tên + địa chỉ (VD: "Cô Nga ở Khâm Thiên" → khách Cô Nguyễn Thị Nga, đơn tủ bếp tại ngõ 46 Khâm Thiên). Gợi ý liên kết khác hiển thị kèm lý do và % khớp.
- Bảo mật: nhân viên chỉ thấy hội thoại được giao hoặc chưa ai nhận (bật/tắt ở Cài đặt); áp dụng cả ở máy chủ bằng RLS (supabase-v32.sql). Liên kết / phân công ghi nhật ký kiểm toán. Quyền mới: zalo.reply, zalo.assign.
- Máy chủ: `/api/zalo/send` (tin tư vấn OA), `/api/zalo/zns` (ZNS theo mẫu đã duyệt), `/api/zalo/webhook?tenant=<mã>` (nhận tin, xác thực chữ ký, ghi vào Supabase qua hàm zalo_ingest — chỉ dùng khóa anon + mã bí mật). Chưa cấu hình: chạy chế độ mô phỏng (nút "Mô phỏng tin đến").

### Phần 2 — Tìm kiếm toàn cục & tìm bằng hình ảnh
- Ô tìm kiếm (Ctrl/⌘+K): tìm nhiều từ ("cô nga khâm thiên"), theo MST / SĐT (so phần số), thêm đơn hàng công trình, sản phẩm, hội thoại Zalo, chiến dịch. Gõ `>` để ra lệnh; câu có "phân tích / dự báo / báo cáo / rủi ro / thưởng…" đưa lên mục Hỏi AI Copilot.
- Tìm bằng ảnh: biểu tượng máy ảnh trên ô tìm kiếm, kéo thả hoặc dán ảnh (Ctrl+V). So khớp cục bộ (ảnh sản phẩm, ảnh / bản vẽ công trình, tên file) và khi có AI: nhận diện loại, vật liệu, màu rồi đối chiếu danh mục (SKU, hạng mục báo giá, vật tư, đơn hàng, dự án). Bản vẽ CAD / SketchUp: xuất ra PNG / JPG.

### Phần 3 — AI Copilot (Claude và OpenAI, chọn ở Cài đặt > AI & Zalo Hub)
- `/api/ai`: khóa API chỉ ở máy chủ, bắt buộc đăng nhập Supabase và đúng doanh nghiệp, giới hạn tần suất; tùy chọn che SĐT / email trước khi gửi.
- Copilot tính số liệu tất định trong app trước (rủi ro trễ SLA có điểm và lý do, dự báo dòng tiền quỹ MDF 6 tháng, thưởng tăng trưởng đại lý, bản tin), sau đó AI diễn giải trên chính số liệu đó; không có AI vẫn trả lời bằng bộ phân tích cục bộ.
- Bản tin điều hành mỗi sáng cho BOD trên Bàn làm việc (tự tạo sau giờ cấu hình; Tạo lại / Sao chép / Đăng Kênh chung).
- @AI trong mọi kênh chat / tin nhắn: gõ "@AI câu hỏi", Trợ lý AI trả lời ngay trong kênh. Kiến thức cho AI (Cài đặt) gồm chính sách thưởng đại lý: tăng trưởng ≥ 7% thưởng 10 tr mỗi 100 tr doanh thu tăng thêm (sửa được ngưỡng, bậc, mức thưởng, cách tính).
- Soạn thảo: email báo giá (nút "Soạn email" ở danh sách báo giá), tin chăm sóc khách, kịch bản Zalo OA, quảng cáo, thông cáo báo chí, ZNS.

### Phần 4 — Marketing Hub (menu trái, nhóm Vận hành Bán hàng)
- Lịch chiến dịch theo tháng, ngân sách & ROI từng chiến dịch và từng kênh (lead theo kênh nguồn và thời gian chạy, CPL, chốt, doanh thu, ROI).
- Content Studio có AI Copilot, quy trình Nháp → Chờ duyệt → Đã duyệt → Đã đăng.
- Thiết kế banner trong app: 4 mẫu, 5 kích thước, ảnh nền / ảnh sản phẩm, màu, AI gợi ý tiêu đề, xuất PNG đúng kích thước.
- Phân khúc khách hàng (micro-segmentation) theo hạng, nhóm, miền, nguồn, địa chỉ, doanh số, tăng trưởng, công nợ, kết nối Zalo; xuất CSV.
- Tự động hóa: kích hoạt khi có lead mới / báo giá chưa phản hồi N ngày / khách chốt đơn / khách mới quan tâm OA / khách chưa mua lại / cả phân khúc; nhiều bước chờ X giờ gửi ZNS / Zalo OA / SMS / Email; mặc định "Chạy thử" (không gửi thật), nhật ký gửi đầy đủ, mỗi đối tượng chạy 1 lần.

### Cài đặt máy chủ cho v32
1. Chạy `supabase-v32.sql` trong Supabase SQL Editor (sau file supabase-setup.sql).
2. Đặt mã bí mật webhook: `select public.set_integration_token('vassh', 'zalo', '<chuỗi ngẫu nhiên dài>');` (đăng nhập tài khoản Giám đốc / quản trị, hoặc chạy trong SQL Editor sau khi thêm mình vào platform_admins).
3. Khai báo biến môi trường theo `env.local.example` (Vercel > Settings > Environment Variables), deploy lại.
4. Zalo for Developers: khai báo URL webhook (Cài đặt > AI & Zalo Hub có nút sao chép), bật các sự kiện user_send_text / user_send_image / follow / user_submit_info.
5. Kiểm tra lại công thức chữ ký webhook và hạn mức gửi tin tư vấn / ZNS theo tài liệu Zalo hiện hành của OA.

Lưu ý: access token Zalo được làm mới trong bộ nhớ tiến trình máy chủ; trên Vercel (serverless) nên cập nhật ZALO_OA_REFRESH_TOKEN định kỳ hoặc dùng máy chủ chạy liên tục. Kịch bản tự động chạy trên phiên trình duyệt của Marketing / BOD đang mở app (mỗi phút). Dữ liệu nâng lên DATA_VERSION 25, chỉ thêm nhóm dữ liệu mới.

## Điểm mới v31 — Bảng dữ liệu thống nhất
- Mọi bảng danh sách dùng chung một khuôn theo bảng Sản phẩm: cột **STT** ở đầu (đánh số liên tục khi chuyển trang), tiêu đề in hoa cỡ nhỏ, số liệu căn phải font số, dòng xen kẽ nền nhạt, rê chuột tô sáng.
- Cột cuối chuẩn hóa thành **Thao tác**, căn phải, nút gọn một hàng.
- Các bảng phụ trong cửa sổ (định mức BOQ, chi phí claim, dòng PO, tồn theo kho, phiếu kho, module Console, đơn Getfly) theo cùng kiểu tiêu đề và dòng.
- Bảng ma trận (phân quyền, kênh thông báo, chứng từ) và bảng tổng hợp nhỏ trong Tổng quan giữ nguyên không có STT. Trên điện thoại vẫn hiển thị dạng thẻ.
- Trang Sản phẩm bỏ các thẻ KPI: mở trang là thấy ngay tab, nút Nhập / Xuất Excel, Thêm sản phẩm mới và bảng. Lọc “Dưới Min / Sắp chạm Min” vẫn có trong ô Tình trạng tồn.
- Kỹ thuật: `Table` có thêm `stt` (số bắt đầu, `false` để tắt); STT dùng CSS counter nên không phải sửa từng dòng.

## Điểm mới v30 — Trang Sản phẩm
- Bảng: **STT · SKU · Tên sản phẩm · Giá bán lẻ · Giá đại lý · Giá dự án · Tồn kho · Lead-time · Tài liệu · Thao tác**; bấm dòng mở **Chi tiết sản phẩm** (thông tin, giá & lãi gộp, tồn theo kho, tài liệu, phát sinh gần đây).
- Nút **Nhập Excel · Xuất Excel · Thêm sản phẩm mới** nằm dưới thẻ KPI, ngang hàng tab Tất cả / Còn hàng / Hết hàng / Lưu trữ, phía trên bên phải bảng.
- Bộ lọc: ô tìm + Kho, Thương hiệu, Phân loại, Tình trạng tồn trên thanh; **Bộ lọc khác** (nhà cung cấp, xuất xứ, ĐVT, khoảng giá bán lẻ, lead-time tối đa, đang đặt Hãng, có tài liệu, có ảnh); **chip điều kiện đang lọc** (bỏ từng cái / xóa tất cả); **Bộ lọc của tôi** (lưu & dùng lại).
- Form thêm / sửa theo thứ tự bảng: ① Sản phẩm (SKU, tên, ĐVT) ② Giá bán (kèm lãi gộp) ③ Tồn kho & lead-time (tồn đầu kỳ theo kho, Min/Max) ④ Tài liệu (đính kèm nhiều file) ⑤ Thông tin bổ sung (ảnh, thương hiệu, phân loại, NCC, xuất xứ, VAT, giá vốn).
- File Excel mẫu / xuất file theo cùng thứ tự cột; ĐVT không bắt buộc (mặc định “Cái”); cập nhật SKU đã có thì ô trống giữ giá trị cũ. Trạng thái tồn thêm mức “Hết hàng”.

## Điểm mới v29 — Kho hàng (`#/vassh/warehouse`)
| Tab | Nội dung |
|---|---|
| Tồn kho | Ma trận Tổng + từng kho (bấm mã kho để thêm cột), mỗi kho **Thực tế / Khả dụng**; lọc Còn hàng / Hết hàng |
| Nhập / Xuất / Chuyển kho | Phiếu NK / XK / CK mã tự động, loại phiếu, chứng từ gốc (PO, đơn hàng), nhà cung cấp / khách hàng, dòng hàng có đơn giá; **Chờ duyệt → Hoàn tất / Hủy**; tồn chỉ đổi khi duyệt; hủy phiếu đã duyệt tự hoàn tồn; **in phiếu** (A4, có ô ký) |
| Kiểm kho | Phiếu KK: nạp toàn bộ hàng của kho, nhập số đếm, xem chênh lệch, duyệt là cân đối tồn |
| Thẻ kho | Từng mặt hàng × kho: nhập, xuất, tồn lũy kế, người thực hiện |
| Xuất nhập tồn | Theo kỳ đang chọn: tồn đầu, nhập, xuất, tồn cuối (số lượng + giá trị), xuất Excel |
| Danh mục kho | Mã, tên, địa chỉ, thủ kho, trạng thái |

Quyền: `stock.voucher` (lập phiếu: BOD, Trưởng phòng, Sales, Kế toán), `stock.approve` (duyệt: BOD, Kế toán) và **thủ kho của kho đó** cũng được duyệt.
Sản phẩm: tab Tất cả / Còn hàng / Hết hàng / Lưu trữ; Bộ lọc nâng cao (phân loại, ĐVT, nhà cung cấp, xuất xứ, thương hiệu, tình trạng) + **lưu bộ lọc của tôi**; form chia nhóm Thông tin chung / Giá & thuế / Tồn kho, thêm ảnh, VAT, nhà cung cấp, xuất xứ; tồn chỉ thay đổi qua phiếu kho (sản phẩm mới có tồn đầu kỳ theo kho). Nút Nhập kho trên dòng sản phẩm lập phiếu nhập; bấm số tồn → chi tiết từng kho, Thẻ kho, Lập phiếu chuyển kho.

## Điểm mới v28 — Sản phẩm & Đa kho (`#/vassh/products`, `#/vassh/settings/warehouses`)
| Hạng mục | Nội dung |
|---|---|
| Nhập Excel | File mẫu `Template_DanhMuc_SanPham.xlsx` (3 trang: danh mục, hướng dẫn, mã kho). Đọc .xlsx / .csv, xem trước, tô đỏ dòng lỗi (SKU sai / trùng, thiếu trường, số sai, Max < Min, mã kho không có). SKU đã có: bỏ qua hoặc cập nhật (giữ tồn). Tồn đầu kỳ theo `Mã kho`, nhiều kho = nhiều dòng cùng SKU |
| Xuất Excel / CSV | Theo bộ lọc hiện tại hoặc toàn bộ; có cột tồn theo từng kho; giá vốn chỉ xuất khi có quyền xem giá vốn |
| Bảng sản phẩm | SKU + ảnh đại diện · Tên & quy cách (thương hiệu, phân loại, ĐVT, vốn) · Bảng giá Bán lẻ / Đại lý / Dự án · Tồn tự do, giữ chỗ, tổng + chi tiết từng kho + trạng thái 🟢 Trong định mức / 🟡 Sắp chạm Min (≤ Min×1,2) / 🔴 Dưới Min · Min/Max, đang đặt, lead-time · Sửa / Nhập kho / Xóa (SKU còn PO, giữ chỗ hoặc tồn thì chuyển Lưu trữ) |
| Đa kho | Bộ chọn kho trên đầu trang: KPI và bảng lọc theo tồn tại kho. Bấm số tồn: chi tiết theo kho + điều chuyển (ghi lịch sử “Điều chuyển giữa các kho”). Cài đặt › Kho hàng: mã, tên, địa chỉ, quản lý kho, trạng thái (kho còn hàng không tạm ngưng được) |

## Điểm mới v27
| Bước | Nội dung |
|---|---|
| 1. Khung ứng dụng | Nút 9 chấm (12 ứng dụng theo quyền) + ghim phân hệ “Hay dùng”; nút “Thêm nhanh”; kỳ dữ liệu trên header; thanh công cụ dọc bên phải (≥1280px); menu trái luôn nền tối Navy, nội dung mặc định nền sáng; khối KPI và thẻ có nền + viền rõ |
| 2. Widget chuẩn | Mọi widget: tiêu đề · Kỳ · ĐVT · “Số liệu tính đến hh:mm · Tải lại” (`WidgetCard`) |
| 3. Danh bạ | Nội bộ + người liên hệ khách hàng; Chat, gọi, email, sao chép, vCard; Yêu thích, Gần đây, Nhãn; lọc phòng ban / nhóm khách |
| 4. Chat | Tab Hội thoại / Ưa thích / Trợ lý AI; màn chào; AI tóm tắt hội thoại; chip @ai; thông báo trình duyệt |
| 5. Bàn làm việc | Trang đầu sau đăng nhập: bảng tin (Chia sẻ, Thông báo, Sáng kiến, Bình chọn), thích, bình luận @, lưu, hashtag, tóm tắt bài dài, hoạt động kinh doanh tự động, sinh nhật, widget Trợ lý số / Việc của tôi / Bán hàng xuất sắc. Quyền mới: `feed.moderate`, `feed.poll` |

## Điểm mới v26

| Giai đoạn | Nội dung |
|---|---|
| P1 Design System | Token màu CSS (Navy #172B49, Blue #2563EB, Orange #F28C28, Green #10B981, nền #F5F7FA / #101827), Dark/Light đồng bộ, nút Primary/Accent/Ghost/Danger, toast có Hoàn tác, không popup chồng popup, Esc đóng lớp trên cùng |
| P2 Core Layout | Định tuyến theo URL (Back/Forward, link trực tiếp), giữ ngữ cảnh tab/tìm kiếm khi quay lại, bắt lỗi từng module, Skeleton khi tải |
| P3 Dashboard | Tổng quan 3A Platform (KPI, bản quyền, cảnh báo, hoạt động), rà lại dashboard VASSH / ALUX |
| P4 CRM & Lead | Sắp xếp theo cột dùng chung (7 danh sách), Pipeline Kanban có tổng giá trị theo giai đoạn |
| P5 Sales & Project | Bước Thiết kế & bản vẽ cho lệnh sản xuất ALUX, dòng thời gian thi công trong đơn hàng |
| P6 Finance & Document | Xóa có Hoàn tác (lead, khách hàng, dự án, phiếu thu chi, tài liệu, danh mục) |
| P7 Mobile | Bảng tự thành thẻ dưới 768px, ô nhập 44px, nút chân form full-width, 0 trang tràn ngang |
| P8 Platform Console | Tab Người dùng & quyền toàn nền tảng; SQL: vai trò thành viên, chỉ Giám đốc sửa phân quyền / bảo mật, tin nhắn riêng & nhóm kín chỉ thành viên đọc |

## Sau khi chạy SQL v26 (Supabase)

Tài khoản cũ chưa có vai trò vẫn hoạt động như trước. Vai trò được gán tự động khi Giám đốc tạo tài khoản, đổi vai trò hoặc đặt lại mật khẩu trong Cài đặt. Muốn gán ngay cho toàn bộ: vào Cài đặt > Nhân sự, bấm “Đặt lại mật khẩu” từng người, hoặc gọi `select set_member_profile('email', 'vassh', 'SALES_REP', '<mã nhân sự>')`.
