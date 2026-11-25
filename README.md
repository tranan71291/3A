# 3A CRM v56.2 (Nhiệm vụ nội dung 3 bước, nối với 3A Studio — cùng nhánh v56)

## Cập nhật v56.2 (25/11)

**Triển khai theo thứ tự**
1. Supabase › SQL Editor: chạy `supabase-v56.2.sql` (sau `v56`). Chỉ thay hàm trigger, không đổi bảng, không đổi dữ liệu. Chưa cài v56 thì chạy `v55.1` → `v55.3` → `v56` → `v56.2`.
2. Chạy `scripts/cai-dat-v56.2.ps1` (cùng nhánh `v56`, chạy được cả khi chưa cài v56 / v56.0.1).
3. Không có biến môi trường mới.

**1. Đối tượng `content_task` trong 3A Studio**
- `contentTasks` trong yêu cầu = bộ sưu tập `mktTasks` đang dùng. Bộ này đã nằm trong `KEYED_COLLS` (mỗi nhiệm vụ 1 dòng theo `id`), nên giữ tên cũ, không chuyển dữ liệu.
- Mỗi nhiệm vụ có thêm `cf` (giá trị trường tùy chỉnh) và `productSku` (sản phẩm trọng tâm).
- Trường tùy chỉnh có đối tượng mới **Nhiệm vụ nội dung**. Mức bắt buộc ghi là **"Trước khi giao AI"**: lưu nháp luôn được, chỉ chặn lúc giao.
- 3 trang mới trong Thiết kế giao diện, mỗi trang một khối Form:
  - `content-step-1` Bước 1: Định hướng
  - `content-step-2` Bước 2: Kịch bản nội dung
  - `content-step-3` Bước 3: Cấu hình hình ảnh
- 17 trường gốc đặt được trong khối Form:
  - Bước 1: Chủ đề / ý tưởng, Kênh đăng, Ngày đăng, Sản phẩm / dịch vụ trọng tâm, Chiến dịch, Loại nội dung, Phụ trách;
  - Bước 2: Mẫu nhanh, Yêu cầu soạn bài, Thông số kênh (từ khóa, SEO), Thông số kênh mặc định, Brief chi tiết, Ghi chú thêm cho bài;
  - Bước 3: Yêu cầu hình ảnh, Ảnh tham chiếu, Cài đặt nâng cao hình ảnh, Ghi chú thêm cho ảnh.
- Bố cục mặc định chuẩn có sẵn khi 3A chưa thiết kế. 3A kéo-thả, đổi nhãn, đổi độ rộng, đặt trường tùy chỉnh vào bước bất kỳ rồi phát hành như các trang khác.
- Quy tắc ghép 3 bước:
  - Chủ đề và Kênh đăng luôn ở Bước 1;
  - mỗi trường chỉ hiện 1 lần;
  - trường tùy chỉnh mới (cờ "Form") tự vào Bước 1, trừ khi 3A đã đặt ở Bước 2 / 3;
  - Thông số kênh chưa đặt ở đâu thì tự thêm cuối Bước 2 (kiểm tra bắt buộc của kênh cần các ô này).
- Màn xem trước trong Studio dùng chung `DynamicFieldRenderer` với bảng thật. Trường gốc hiện giá trị mẫu.

**2. Bảng trượt "Nhiệm vụ mới" (Auto Content › Kế hoạch)**
- Rộng 580px. Thanh 3 bước dính trên cùng: bấm để chuyển bước, chấm đỏ là bước còn thiếu thông tin.
- Chân bảng dính: Xóa (biểu tượng) · ← Quay lại · Lưu nháp · Tiếp tục → · ✨ Giao cho AI xử lý.
- Bỏ ô "Trạng thái thủ công". Trạng thái hiện ở dưới tiêu đề. Bài đăng ngoài hệ thống: dòng nhỏ "Đánh dấu đã đăng" ở cuối Bước 1.
- **Bước 1**:
  - nút **Gợi ý tiêu đề** cho 3–5 tiêu đề để chọn ngay dưới ô (không mở thêm cửa sổ);
  - chọn **Sản phẩm / dịch vụ trọng tâm**: ảnh sản phẩm tự thành ảnh tham chiếu ở Bước 3, tên sản phẩm tự vào "Sản phẩm / mã hàng cần nhắc tới" ở Bước 2, thông số sản phẩm vào ngữ cảnh gửi AI.
- **Bước 2**:
  - Mẫu nhanh thành thanh chip ngang 1 dòng;
  - khối "Yêu cầu soạn bài" ở giữa;
  - SĐT, liên kết, hashtag cố định (kênh Facebook / Zalo) gom vào thẻ thu gọn "Kế thừa từ thương hiệu". Thẻ tự mở khi còn thiếu, có nút "Lấy lại theo thương hiệu".
- **Bước 3**:
  - Số lượng ảnh: **1 ảnh đơn / Bộ ảnh theo từng ý / Không dùng ảnh**. Nhiệm vụ cũ chọn "Tối đa 3 ảnh" vẫn ra đúng 3 ảnh;
  - Ảnh tham chiếu: sản phẩm chưa có ảnh thì có nút **Tải ảnh cho [mã]**. Ảnh lưu vào sản phẩm (cùng cách màn Sản phẩm) và tự chọn làm tham chiếu. Chỉ người có quyền quản lý sản phẩm thấy nút;
  - Cài đặt nâng cao: **Mô hình tạo ảnh** Nhanh (mặc định, `gpt-image-2.5-flare`) / Chi tiết cao (`gpt-image-2.5-sunburst`).
- Bấm Giao khi còn thiếu: về bước thiếu đầu tiên, báo tên ô cần nhập.

**3. Ngữ cảnh gửi AI**
- Lúc giao, hệ thống ghép `aiCtx` vào bản nội dung:
  - sản phẩm trọng tâm: tên, mã, thương hiệu, đơn vị, xuất xứ, thông số do 3A định nghĩa cho sản phẩm;
  - mọi trường tùy chỉnh có giá trị của nhiệm vụ, dạng "nhãn: giá trị" (nhãn theo bố cục 3A).
- Bộ soạn nền gửi kèm ngữ cảnh này ở lời gọi lập dàn ý, soạn từng mục và mô tả ảnh. Ảnh gửi đúng chế độ Nhanh / Chi tiết cao đã chọn.

**4. Máy chủ (`supabase-v56.2.sql`)**
- Trigger `records_cf_guard` nhận thêm `mktTasks` → `content_task`. Chỉ kiểm tra **kiểu dữ liệu** (số, ngày, danh sách chọn…), không chặn lưu nháp vì thiếu trường.
- RLS không đổi: nhiệm vụ vẫn theo `tenant_id` của doanh nghiệp.

**Kiểm tra**: TypeScript không lỗi (kể cả strict).
- Giao diện 43 / 43 (`anh-v56.2/ket-qua-chay-thu.txt`): bảng 33, Studio 10.
- SQL (`anh-v56.2/kiem-tra-sql-v56.2.sql`, PostgreSQL 16):
  - sai kiểu số và giá trị ngoài danh sách bị chặn;
  - nháp thiếu trường bắt buộc lưu được;
  - nhiệm vụ cũ không có `cf` lưu được;
  - doanh nghiệp khác không bị ảnh hưởng.
- Chạy lại bộ thử v56, v56.0.1, v55.3, v55.2.1: 108 / 108 đạt.


## Cập nhật v56.0.1 (25/11)

**Nguyên nhân lỗi "The model 'gpt-image-1' does not exist"**: OpenAI đã ngừng mô hình `gpt-image-1` từ 23/10/2026. Code cũ dùng tên này làm mặc định. Cài đặt vẫn báo "Đã kết nối" vì chỉ xét máy chủ có `OPENAI_API_KEY` hay không.

**Triển khai**
1. Không có SQL mới. Nếu chưa cài v56: vẫn chạy 3 file SQL theo thứ tự `v55.1` → `v55.3` → `v56` như hướng dẫn v56.
2. Vercel › Settings › Environment Variables:
   - `OPENAI_IMAGE_MODEL`: **để trống** (mặc định `gpt-image-2.5-flare`) hoặc xóa giá trị `gpt-image-1`. Nếu vẫn để `gpt-image-1`, máy chủ tự dùng mô hình mới và ghi cảnh báo vào log.
   - Tùy chọn: `OPENAI_IMAGE_MODEL_DETAIL` (mặc định `gpt-image-2.5-sunburst`).
3. Chạy `scripts/cai-dat-v56.0.1.ps1` (cùng nhánh `v56`; chạy được cả khi chưa cài v56 vì zip chứa toàn bộ code).
4. Vào Cài đặt › AI & trợ lý: thẻ "Tạo ảnh" phải báo **Sẵn sàng** cho cả 2 chế độ. Nếu báo lỗi xác minh tổ chức: platform.openai.com › Organization › General › Verify.

**1. Máy chủ (`src/app/api`)**
- `_lib/image.ts` (mới):
  - 2 chế độ: **Nhanh** = `gpt-image-2.5-flare` (mặc định), **Chi tiết cao** = `gpt-image-2.5-sunburst`;
  - ghi đè bằng `OPENAI_IMAGE_MODEL` / `OPENAI_IMAGE_MODEL_DETAIL`, theo doanh nghiệp thêm `__MA_DN`;
  - tên mô hình đã ngừng (`gpt-image-1`, `dall-e-2/3`…) tự đổi sang mô hình hiện hành.
- `ai/image/route.ts`:
  - nhận `mode: 'fast' | 'detail'`;
  - `{ check: true }` hỏi OpenAI 2 mô hình còn dùng được không (`GET /v1/models/{id}`, không tạo ảnh, không tốn phí, lưu kết quả 10 phút);
  - mô hình mới không nhận `input_fidelity` hoặc kích thước cũ thì tự bỏ tham số đó / dùng `size=auto` và gửi lại 1 lần (app vẫn cắt đúng khung đã chọn);
  - lỗi trả về thành mã có nghĩa: `image_model_unavailable`, `image_org_unverified`, `image_billing`, `image_policy`, `image_key_invalid`, `image_rate_limited`…
- `integrations/route.ts`: `models.image` / `models.imageDetail` là mô hình thực dùng.
- Khóa API vẫn chỉ ở máy chủ.

**2. Cài đặt › AI & trợ lý**
- Thẻ **Tạo ảnh** hiện 2 dòng Nhanh / Chi tiết cao, mỗi dòng có trạng thái thật: Sẵn sàng · Không dùng được · Chưa có khóa · Đang kiểm tra. Một chế độ lỗi thì báo "Dùng được 1/2 chế độ" kèm lý do tiếng Việt.
- Thêm thẻ **Thử tạo ảnh**: tạo 1 ảnh vuông chế độ Nhanh, hiện ảnh + mô hình + thời gian.

**3. Màn Auto Content › Hình ảnh (gọn lại, theo THEME_CSS)**
- Không còn gọi tên AI trên giao diện: "Tạo ảnh", "Mô tả cảnh", "Viết từ chủ đề"; bỏ biểu tượng lấp lánh.
- 2 cột cân:
  - trái là thiết lập ("Nội dung ảnh" gộp chủ đề, mô tả, ảnh sản phẩm tham chiếu; "Khung hình & phong cách"; "Xuất file & SEO" thu gọn sẵn, hiện tóm tắt tên file);
  - nút **Tạo N ảnh W × H** dính chân cột;
  - phải là **khung xem trước đúng tỉ lệ đã chọn**, dính khi cuộn, nhãn kích thước chữ mono ở góc, ảnh tham chiếu mờ phía sau khi chưa có kết quả.
- Chọn **chế độ Nhanh / Chi tiết cao** ngay trên màn (nhớ theo người dùng), kèm dòng gợi ý khi nào dùng.
- Kết quả: ảnh lớn trong khung + dải các phương án, tên file / KB / mô hình, Tải về, Lưu vào thư viện.
- Mức bám ảnh sản phẩm hiện bằng lời ("Giữ sản phẩm, đổi bối cảnh và góc chụp"…) thay cho số 0,35.
- Lỗi hiện thành thẻ tiếng Việt trong khung xem trước, có việc cần làm và nút "Mở Cài đặt tạo ảnh".
- Tạo ảnh chưa bật thật (trợ lý tắt, tính năng tắt, máy chủ chưa có khóa) thì báo trước là sẽ ra ảnh mẫu.
- Nút bỏ ảnh tham chiếu đổi sang nút trung tính.
- Nhãn SEO tiếng Việt: Mô tả ảnh (alt), Chú thích, Tiêu đề ảnh (title).

**Kiểm tra**: TypeScript không lỗi (kể cả strict, gồm route máy chủ).
- **Máy chủ 16 / 16** (`anh-v56.0.1/kiem-tra-may-chu.js`, OpenAI giả lập):
  - mặc định flare, chế độ chi tiết sunburst, `gpt-image-1` trong biến môi trường tự đổi, ghi đè theo doanh nghiệp;
  - tự bỏ `input_fidelity` / đổi `size=auto` rồi gửi lại;
  - 5 loại lỗi có nghĩa;
  - kiểm tra mô hình không tạo ảnh và có lưu 10 phút; không có khóa; `/api/integrations` trả mô hình mới.
- **Giao diện 13 / 13** (`anh-v56.0.1/ket-qua-chay-thu.txt`):
  - không còn chữ AI, SEO thu gọn, khung 3:2, nút tạo trong màn hình đầu;
  - thẻ lỗi tiếng Việt;
  - chế độ Nhanh mặc định, Chi tiết cao gửi đúng `mode=detail`, 2 phương án và chọn phương án 2;
  - Cài đặt báo "Dùng được 1/2 chế độ" và lý do; Tạo ảnh thử.
- **Còn phải xác nhận trên khóa thật của anh**: kích thước và `input_fidelity` mà 2 mô hình 2.5 nhận. Code đã tự xử lý khi bị từ chối. Bấm "Tạo ảnh thử" để xác nhận.

## Cập nhật v56 (24/11)

**Triển khai theo thứ tự**
1. Supabase › SQL Editor: chạy `supabase-v56.sql` (sau v55.1 và v55.3). Chạy lại nhiều lần vẫn an toàn, không sửa dữ liệu doanh nghiệp. Cách hoàn tác ghi ở cuối file.
2. Chạy `scripts/cai-dat-v56.ps1`: tạo nhánh `v56` (từ `v55` nếu `v55` chưa gộp vào main), build thử, đẩy lên GitHub. Mở Pull Request, xem bản Vercel Preview rồi gộp.
3. Báo mọi người tải lại trang. Dữ liệu trên máy tự nâng lên phiên bản 32 (thêm nhóm `resources`, không đổi dữ liệu cũ).

**1. Ngành nghề và bộ mẫu ngành (`IndustryProfile`, lưu ở `_platform/industryProfiles`)**
- 6 ngành chuẩn:
  - đủ bộ mẫu: `trade` (Phân phối thương mại), `mfg_install` (Sản xuất & lắp đặt);
  - mới có hạ tầng (thuật ngữ, trạng thái, loại tài nguyên): `studio`, `car_rental`, `booking`, `canteen`.
- Mỗi hồ sơ ngành gồm: từ điển thuật ngữ, quy trình trạng thái (`workflowStates`, dùng cho các khối V56.1), loại tài nguyên, trường mẫu, bố cục mẫu.
- Bản có sẵn trong code: `src/crm/lib/industry.ts`. `supabase-v56.sql` nạp đúng bản này vào `_platform` (chỉ thêm khi chưa có). 3A sửa thuật ngữ trong Console thì bản 3A thắng.
- Ngành của doanh nghiệp: `TenantReg.industry`. Chưa đặt thì theo mô hình: Xưởng = Sản xuất & lắp đặt, còn lại = Thương mại.

**2. Bộ mẫu 2 ngành trọng điểm**
- **Thương mại** — trường:
  - Tuyến giao (danh sách chọn);
  - Xe giao hàng (chọn tài nguyên, chống trùng theo Khung giờ giao);
  - Khung giờ giao (khoảng thời gian);
  - Thời hạn nợ (khách hàng, số ngày).

  "Kho xuất" và "Hạn mức nợ" dùng **trường gốc** (`wh`, `creditLimit`) đặt sẵn trong bố cục, nhãn "Hạn mức nợ". Không tạo trường trùng: kiểm tra công nợ và kế toán vẫn đọc trường gốc.

  Bố cục: Quản lý đơn hàng, Chi tiết đơn, Form lên đơn, Danh sách khách hàng, Chi tiết / form khách hàng.
- **Sản xuất & lắp đặt (ALUX)** — trường:
  - Địa chỉ công trình (bắt buộc khi lưu);
  - Khối lượng (m²);
  - Đơn giá lắp đặt / m²;
  - Giá trị lắp đặt (công thức = Khối lượng × Đơn giá);
  - Lịch lắp đặt (khoảng thời gian);
  - Đội lắp đặt (chọn tài nguyên, chống trùng lịch);
  - Checklist kỹ thuật (7 công đoạn);
  - Ảnh nghiệm thu;
  - Chữ ký nghiệm thu.

  Bố cục: Quản lý lệnh, Chi tiết lệnh (nhóm Công trình / Lắp đặt / Nghiệm thu), Form tạo lệnh.

  Thuật ngữ: "Lệnh sản xuất & lắp đặt", menu "Lệnh SX & lắp đặt", nút "Tạo lệnh". Theo phương án đã chốt, lệnh dùng luồng đơn bán; không đụng module Xưởng.

**3. Nhân bản mẫu ngành cho doanh nghiệp (3A Console › Doanh nghiệp)**
- Cột **Ngành** và mục **Ngành & mẫu ngành** mở bảng trượt bên phải, gồm: chọn ngành, xem thuật ngữ, quy trình, loại tài nguyên, danh sách trường mẫu (Mới / Bỏ qua) và bố cục mẫu.
- **Áp dụng bộ mẫu ngành** sao chép thành **bản riêng** của doanh nghiệp:
  - trường: `levels.tenants = [mã DN]`, `fromIndustry`;
  - bố cục: `tenantId = mã DN`, đã phát hành, nơi áp dụng "Riêng doanh nghiệp";
  - ghi `industryApplied` và nhật ký nền tảng.
- Không xóa gì. Trường cùng mã đã có thì bỏ qua. Áp dụng lại phải tích "Thay N bố cục riêng".
- Cùng mã trường được dùng cho nhiều doanh nghiệp khi phạm vi riêng tách biệt (mỗi DN một bản sao).
- **Thêm doanh nghiệp** có ô chọn Ngành nghề; tạo xong mở luôn bảng Ngành & mẫu ngành.
- **Studio bố cục riêng**: nút "Mở Studio" ở bảng trượt mở `#/console/design/<trang>/<id bản riêng>` (bản nháp mới: `new@<mã DN>`). Nhân sự 3A kéo thả tinh chỉnh riêng cho doanh nghiệp đó:
  - bản nháp, lịch sử, phát hành tách khỏi bố cục chung;
  - phát hành chỉ cho chính doanh nghiệp;
  - Health Check đối chiếu với đúng doanh nghiệp đó.

**4. Từ điển thuật ngữ `useTerminology()`**
- `const { t, code, profile } = useTerminology(); t('saleList')`.
- Các khóa: `module.sales`, `sale`, `saleShort`, `saleList`, `newSale`, `createSale`, `editSale`, `customer`, `resource`.
- Đã áp vào: menu trái và tiêu đề trang (phân hệ Bán hàng), tiêu đề Quản lý đơn, nút tạo mới, tiêu đề form tạo / sửa, đường dẫn quay lại ở chi tiết / duyệt / thu tiền.
- 3A sửa thuật ngữ ngay trong bảng Ngành & mẫu ngành.

**5. Tài nguyên doanh nghiệp (Cài đặt › Tài nguyên)**
- Doanh nghiệp tự thêm / sửa / ngừng dùng đội thợ, xe, phòng chụp… Loại tài nguyên theo ngành.
- Cột "Lịch sắp tới" lấy từ các đơn đang giữ tài nguyên.
- Lưu từng bản ghi (`resources` trong `KEYED_COLLS`). Tài nguyên ngừng dùng vẫn giữ lịch cũ.

**6. Kiểu trường chuyên ngành (`CfDef.type`, `DynamicFieldRenderer`, `CfInput`)**
- `datetime_range`: 2 ô bắt đầu / kết thúc, tự tính thời lượng (giờ, ngày + giờ). Lưu dạng `"YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm"`.
- `resource_picker`: chọn tài nguyên theo `resourceKind`, kiểm tra trùng lịch theo trường thời gian `rangeKey` (`checkResourceAvailability`).
  - Đội / xe đã kín giờ đánh dấu "trùng lịch" và báo ngay dưới ô.
  - Lưu đơn / cập nhật thông tin bị chặn; đơn đã hủy không giữ lịch.
- `formula`: biểu thức `+ - * / ( )` trên mã trường số / tiền. Bộ tính riêng, không dùng `eval`. Console báo lỗi mã trường không có. Giá trị tự tính khi nhập và tính lại khi lưu.
- `checklist`: danh sách công đoạn (3A khai báo), thanh tiến độ. Chi tiết hiện "2/7".
- `media_gallery`: ảnh nén, tải lên kho tệp riêng `crm-attach/<DN>/cf/...` (không nhúng base64), tối đa 12 ảnh.
- `signature`: ký trên màn hình, lưu ảnh ở kho riêng kèm mã SHA-256, người ký, thời điểm.
- Ô nhiều điều khiển không bọc trong `<label>`, tránh bấm nhầm kích hoạt ô đầu tiên.
- Console › Trường tùy chỉnh có ô cấu hình cho từng kiểu: loại tài nguyên, trường thời gian, công thức + đơn vị, danh sách công đoạn.

**7. Phía máy chủ (`supabase-v56.sql`)**
- `validate_custom_fields` kiểm tra kiểu 6 trường mới:
  - khoảng thời gian hợp lệ, kết thúc sau bắt đầu;
  - công thức là số;
  - checklist / ảnh là JSON đúng dạng;
  - chữ ký phải có SHA-256 64 ký tự.
- Kiểu chỉ xét khi giá trị đổi, nên 3A sửa định nghĩa không chặn bản ghi cũ.
- `cf_resource_conflict` + trigger `records_cf_guard` chặn trùng lịch tài nguyên kể cả khi gọi thẳng REST API.
  - Khóa giao dịch theo tài nguyên, nên 2 người lưu cùng lúc không cùng chiếm một lịch.
  - Không đổi tài nguyên / giờ thì sửa thông tin khác bình thường.
  - Lỗi trả `CF_INVALID: …`: app giữ bản ghi chờ gửi và báo như v55.3.
- Quyền đọc hồ sơ ngành dùng quy tắc đã mở ở v55.1: người dùng doanh nghiệp đọc được, không đọc `tenants` / `logs`.

**Không đổi**: định khoản (`SALE_REVENUE`, `IN_SALE`), quy tắc không tự duyệt, duyệt lãi gộp xưởng < 25%, luồng duyệt / xuất kho / thu tiền. Trường chuyên ngành nằm trong `cf`, không cộng vào tiền đơn.

**Để V56.1**: 5 khối `K-WorkflowHeader`, `K-StageBoard`, `K-ResourceCalendar`, `K-ChecklistTracker`, `K-QuickPOS` (dữ liệu nền đã có: `workflowStates`, tài nguyên, khoảng thời gian, checklist).

**Kiểm tra**: TypeScript không lỗi (kể cả strict).
- **Chạy thử 41 / 41 mục đạt** (`anh-v56/ket-qua-chay-thu.txt`):
  - Console: cột Ngành, bảng Ngành & mẫu ngành, áp dụng 9 trường + 3 bố cục riêng ALUX, áp dụng lại an toàn;
  - Studio bố cục riêng: tự lưu nháp mang `tenantId`, phát hành chỉ cho ALUX, bố cục chung không bị lẫn;
  - công thức báo lỗi mã trường;
  - ALUX: menu / tiêu đề / nút theo thuật ngữ; thêm 2 đội thợ;
  - tạo lệnh với địa chỉ, khối lượng, công thức tự tính 54.000.000 đ, lịch 1 ngày 4 giờ, đội, 2 công đoạn, 2 ảnh, chữ ký SHA-256;
  - chi tiết lệnh hiện đủ; lệnh thứ 2 trùng giờ đội 1 bị chặn, đổi đội 2 thì lưu được; cột lịch sắp tới;
  - VASSH giữ thuật ngữ gốc, không thấy trường riêng ALUX.
- **Phía máy chủ**: tài nguyên lưu từng dòng; chữ ký lên `crm-attach` (không base64); gọi thẳng API trùng lịch xe bị chặn, khung giờ nối tiếp được ghi, chữ ký thiếu SHA-256 bị chặn.
- **SQL** (`anh-v56/kiem-tra-sql.sql` / `.txt`): 10 tình huống.
- **Hồi quy**: v55.3 (22 + 7 máy chủ), v55.2.1 (41), v55.1 máy chủ (27; mục "phiên bản 31" nay là 32 đúng thiết kế).


## Cập nhật v55.3 (24/11)

**Triển khai theo thứ tự**
1. Supabase › SQL Editor: chạy `supabase-v55.3.sql` (sau v55.1). Chạy lại nhiều lần vẫn an toàn, không sửa dữ liệu đang có. Cách hoàn tác ghi ở cuối file.
2. Chạy `scripts/cai-dat-v55.3.ps1` (nhánh `v55`), gộp vào main.
3. Báo mọi người tải lại trang.

**1. Trường tùy chỉnh theo đối tượng**
- `CfDef.entity`: `'sale' | 'customer' | 'lead' | 'product'`.
- Tab mới trong 3A Studio › Trường tùy chỉnh: Đơn bán hàng · Khách hàng · Lead · Sản phẩm. Mỗi tab có cờ Form / Thông tin / Danh sách riêng. Dòng hàng và "Bắt buộc khi duyệt" chỉ có ở đơn bán.
- Giá trị lưu ở `cf` của từng bản ghi: `Customer.cf`, `Lead.cf`, `SkuItem.cf`.
- `customers`, `leads` đã nằm trong `KEYED_COLLS` từ trước; sản phẩm lưu theo `skus` (khóa `sku`). Không cần chuyển dữ liệu.

**2. Trang thiết kế mới cho từng doanh nghiệp, cùng bộ Studio và `DynamicFieldRenderer`**
- **Danh sách khách hàng** (`customer-list`) và **Danh sách lead · Data MKT** (`lead-list`): khối **Danh sách bản ghi** (`K-RecordList`) chính là bảng thật của phân hệ. 3A chọn cột trường tùy chỉnh và thứ tự cột (mỗi trường một cột, trước cột Thao tác); thêm được khối text / nút / đường kẻ. Xem trước bằng bảng thật với dữ liệu mẫu.
- **Chi tiết / form khách hàng** (`customer-detail`) và **Chi tiết / form lead** (`lead-detail`):
  - khối **Chi tiết bản ghi**, hiện trong hồ sơ khách hàng và hồ sơ dự án / lead, gồm trường tùy chỉnh và trường gốc 3A kéo thêm (MST, người liên hệ, điện thoại…);
  - khối **Form bản ghi**: phần "Thông tin thêm" trong form thêm / sửa khách hàng, thêm / sửa lead.
  - Kéo thả trường, độ rộng, nhãn, gợi ý, chỉ đọc, bắt buộc như trang đơn bán.
- **Sản phẩm**: trường tùy chỉnh hiện trong form thêm / sửa sản phẩm (cờ Form) và chi tiết sản phẩm (cờ Thông tin). Chưa có trang thiết kế riêng (theo phạm vi đã chốt).
- Chưa phát hành bố cục: các trang giữ giao diện gốc, chỉ thêm phần trường tùy chỉnh theo cờ.

**3. Kiểm tra trạng thái hợp lệ (Health Check) trong 3A Studio**
- Khi mở một bản thiết kế, Studio đối chiếu từng `fieldKey` trong khối Chi tiết / Form / Danh sách với trường thực tế:
  - trường **đã bị xóa**;
  - trường **đã ngừng dùng (OFF)**;
  - trường **không áp dụng cho doanh nghiệp** đang nhận trang này (theo các cấp đã phát hành: riêng DN, mô hình, toàn hệ thống).
- Cảnh báo màu vàng hiện:
  - trên thẻ khối ở lưới trang (số trường lỗi);
  - trên từng ô trường ở khung bố cục trường, kèm lý do; ô vẫn giữ để 3A bấm và bỏ;
  - trong ngăn "Kiểm tra trước khi phát hành".

**4. Kiểm tra trường tùy chỉnh phía máy chủ (`supabase-v55.3.sql`)**
- **`validate_custom_fields(p_tenant_id, p_entity, p_stage, p_cf [, p_old_cf])`** trả danh sách lỗi:
  - đọc định nghĩa từ `customFields` của `_platform`, đúng đối tượng, áp dụng cho doanh nghiệp;
  - **bắt buộc**: `SAVE` = bắt buộc khi lưu (trường có cờ Form, không chỉ đọc); `APPROVE` = bắt buộc khi lưu hoặc khi duyệt. Áp `requiredOverride` / `readOnly` theo bố cục form 3A đã phát hành, giống hệt app;
  - **kiểu dữ liệu**: số, số tiền, ngày `YYYY-MM-DD` hợp lệ, true/false, chữ; giá trị danh sách chọn phải nằm trong lựa chọn (chỉ xét khi giá trị đổi, vì 3A bỏ lựa chọn không xóa giá trị cũ).
- **Trigger `records_cf_guard`** trên `records` chặn ghi (mã `P0001`, thông điệp `CF_INVALID: …`) kể cả khi gọi thẳng REST API.
  - Chỉ xét khi tạo bản ghi mới, khi sửa `cf`, hoặc khi đơn bán chuyển sang Đã duyệt.
  - Bản ghi cũ thiếu trường mới đặt bắt buộc vẫn ghi thu tiền / xuất kho / sửa thông tin khác bình thường.
  - Bỏ qua dòng đánh dấu xóa, dữ liệu nền tảng, thao tác của quản trị 3A (khôi phục sao lưu, hỗ trợ).
  - Đơn còn trong dòng gộp cũ (chuyển đổi v55.1) không bị coi là đơn mới.
- **App**:
  - lần gửi bị chặn thì gửi lại từng bản ghi: bản ghi hợp lệ vẫn lưu, bản ghi bị chặn giữ chờ gửi trên máy (không mất) và báo lỗi đồng bộ "Máy chủ từ chối lưu: …";
  - khi 3A sửa cấu hình hoặc người dùng bổ sung, bản ghi tự lưu lên.
- Kiểm tra trước khi lưu trên app (form khách hàng / lead / sản phẩm, form và duyệt đơn) dùng đúng quy tắc này nên bình thường không chạm tới máy chủ.

**Kiểm tra**: TypeScript không lỗi (kể cả strict).
- **Chạy thử 29 / 29 mục đạt** (`anh-v55.3/ket-qua-chay-thu.txt`):
  - tab trường theo đối tượng, tạo trường khách hàng;
  - Health Check: 3 trường lỗi trên khối (đã xóa, OFF, chỉ áp dụng ALUX), ô vàng có lý do, bỏ trường lỗi, ngăn kiểm tra;
  - xem trước Danh sách khách hàng bằng bảng thật, đổi thứ tự cột;
  - thiết kế Chi tiết / form khách hàng: thêm trường gốc, đặt gợi ý; phát hành;
  - Giám đốc: cột trường tùy chỉnh đúng thứ tự, form chặn thiếu trường bắt buộc, lưu `cf`, hồ sơ hiện khối Chi tiết; Data MKT có cột Ngân sách; form lead và form sản phẩm có Thông tin thêm.
- **Phía máy chủ** (PostgreSQL thật qua máy chủ giả lập):
  - gọi thẳng API với giá trị sai hoặc thiếu trường bắt buộc: bị chặn; app lưu khách hàng hợp lệ: lên máy chủ;
  - 3A vừa đặt trường bắt buộc mà máy người dùng chưa nhận: máy chủ chặn đúng bản ghi đó, bản ghi vẫn còn trên máy;
  - 3A hạ yêu cầu bằng bố cục form: máy chủ nhận ngay và bản ghi đang chờ tự lưu lên.
- **10 tình huống SQL** (`anh-v55.3/kiem-tra-sql.txt`): sai kiểu số / ngày / lựa chọn; trường chỉ áp dụng mô hình Xưởng; bản ghi cũ sửa thông tin khác; upsert như app; duyệt đơn thiếu trường; xóa mềm; quản trị 3A.
- **Hồi quy** trên bản này: kịch bản v55.2.1 (41 / 41), v55.1 có trigger (28 / 28), v54.1: không lỗi.

**Lưu ý**
- Lead chưa có trang danh sách riêng ngoài Data MKT (tab Điều phối dạng thẻ giữ nguyên). Khối Chi tiết lead hiện trong hồ sơ dự án / lead.
- Bộ lọc theo trường tùy chỉnh mới có ở Quản lý đơn hàng; khách hàng / lead để chặng sau.
- Quản trị 3A không bị trigger kiểm tra (để khôi phục sao lưu, hỗ trợ dữ liệu).

## (v55.2.1) 3A CRM v55.2.1 (bổ sung Chặng 2: khung trường giữa màn, Field Inspector, độ rộng nhanh, xem trước bằng bảng thật — vẫn nhánh v55)

## Cập nhật v55.2.1 (24/11)

**Cài đặt**: chạy `scripts/cai-dat-v55.2.1.ps1` (nhánh `v55`). Không có SQL mới, không thêm thư viện, không đổi dữ liệu.

**1. Studio Cấp 2 chia 3 cột**
- Chọn khối Thông tin đơn hàng (`K-RecordDetail`) hoặc Thông tin thêm (`K-RecordForm`), bấm **Thiết kế bố cục trường**:
  - **Trái — Trường dữ liệu**: trường chưa đặt. Kéo vào khung giữa, hoặc bấm + để thêm vào nhóm đang chọn.
  - **Giữa — khung trường**, vẽ bằng chính `DynamicFieldRenderer` (cùng component với SaleDetail / SaleForm), có thêm chế độ thiết kế:
    - tạo nhóm, đặt tiêu đề nhóm ngay trên khung;
    - kéo thả trường trong một nhóm và giữa các nhóm;
    - trường đang chọn có nút độ rộng nhanh **1/3 · 1/2 · Cả dòng** và nút bỏ trường.
  - **Phải — Field Inspector**:
    - trường đang chọn: nhãn hiển thị (`labelOverride`), độ rộng (nút nhanh và đủ 1–12 cột), gợi ý trong ô (`placeholder`), chú thích, chỉ đọc (`readOnly`), bắt buộc riêng (`requiredOverride`), chuyển nhóm, lên / xuống, bỏ khỏi bố cục;
    - bấm vào nhóm thì chỉnh tiêu đề, số cột, thu gọn sẵn, thứ tự, xóa nhóm.
- "Về lưới trang" quay lại lưới khối; "Cài đặt khối" mở cài đặt chung của khối. Hoàn tác / Làm lại, tự lưu nháp 2 giây vẫn áp dụng.

**2. Xem trước bằng component thật, không còn HTML mẫu vẽ tay**
- Khối Danh sách đơn hàng trong Studio (khung lưới và Xem trước) dùng chính bảng `SaleList` của doanh nghiệp với 4 đơn mẫu. Cột, tab trạng thái, dòng tổng, nút đầu bảng, bộ lọc, số dòng đều là bảng thật.
- Dữ liệu mẫu nằm trong ngữ cảnh riêng: không đọc dữ liệu doanh nghiệp, mọi thao tác ghi bị vô hiệu, vùng xem trước đặt `inert`.
- Khối Chi tiết / Form đã dùng `DynamicFieldRenderer` từ v55.2. Các khối Hàng hóa, Thanh toán, Quy trình vẫn dùng mẫu như trước (theo phạm vi đã chốt).

**Kiểm tra**: TypeScript không lỗi (kể cả strict). Chạy thử 41 / 41 mục đạt (`anh-v55.2.1/ket-qua-chay-thu.txt`):
- xem trước Quản lý đơn hàng ra bảng thật, đủ 4 đơn mẫu và dòng tổng;
- chế độ 3 cột; thêm nhóm "Vận chuyển"; kéo trường giữa các nhóm và trong nhóm bằng chuột;
- nút "Cả dòng" trên trường; Inspector đổi nhãn "Kênh bán" và chọn 1/2 dòng;
- trường khóa không bỏ được; bỏ Số PO thì trường về cột trái; Hoàn tác / Làm lại;
- Form: bắt buộc khi lưu, gợi ý trong ô, chỉ đọc hiện ngay trên khung giữa;
- toàn bộ kịch bản v55.2 (tự lưu, URL, Back, phát hành, form và chi tiết phía doanh nghiệp, giữ giá trị trường bị bỏ, hỏi lại khi đóng tab).

Chạy lại kịch bản v54.1 và v55.1 trên bản này: không lỗi.

## (v55.2) 3A CRM v55.2 (Chặng 2: tái cấu trúc Page Builder, URL màn thiết kế, kéo thả từng trường dữ liệu — dựa trên v55.1, vẫn nhánh v55)

## Cập nhật v55.2 (24/11)

**Cài đặt**: chạy `scripts/cai-dat-v55.2.ps1` (nhánh `v55`). Không có SQL mới; cần đã chạy `supabase-v55.1.sql`. Gộp vào main xong báo mọi người tải lại trang.

**1. Tách bộ vẽ trang ra `src/crm/modules/page-builder/`** (trước nằm lẫn trong `modules/messages/messenger.tsx`)
- `engine.tsx`: cấu hình mặc định khối, xếp lưới, dữ liệu thật / mẫu, kỳ, biến, kiểu dáng, xuất Excel.
- `blocks.tsx`: khối hiển thị (chỉ số, biểu đồ, text, nút, bộ lọc, tab, mục tiêu, đường kẻ, bảng).
- `views.tsx`: `LayoutView`, `LBusinessView`, nội dung mẫu trang đơn hàng.
- `tenant.tsx`: `useTenantLayout`, `TenantLayoutPage`.
- `fields.tsx`: `CfInput`, `cfText`, `DynamicFieldRenderer`.
- `index.ts`: xuất chung.
- `messenger.tsx` chỉ còn Tin nhắn và các trang Tổng quan. `core.tsx` hết import ngược từ `messenger.tsx`.
- Màn Xem trước của 3A và màn hình doanh nghiệp dùng cùng `DynamicFieldRenderer`.

**2. Màn thiết kế có URL riêng**
- `#/console/design/<trang>/<id phiên bản>`, hoặc `/new` khi trang chưa có bản nháp. Tải lại trang, gửi link, nút Back của trình duyệt đều giữ đúng màn hình; Back đóng màn thiết kế.
- **Tự lưu nháp** sau 2 giây không thao tác; thanh trên ghi "Đã tự lưu hh:mm:ss". Bản nháp đầu tiên tạo ra thì URL tự chuyển sang id bản nháp. Nhật ký nền tảng chỉ ghi lần tự lưu đầu tiên trong mỗi phiên.
- Đóng tab hoặc tải lại khi còn thay đổi chưa lưu: trình duyệt hỏi lại.
- Mở trang chỉ để xem không tự tạo bản nháp. Mỗi trang vẫn chỉ có một bản nháp: mở link phiên bản cũ khi đang có bản nháp thì vào bản nháp và báo cách lấy bản cũ (Lịch sử phiên bản › Khôi phục).

**3. Kéo thả từng trường (Cấp 2)**
- Kiểu mới trong `types.ts`:
  - `LSection { id, title, cols, collapsedByDefault, fields }`;
  - `LFieldItem { id, fieldKey, colSpan 1..12, labelOverride, placeholder, readOnly, requiredOverride, helpText }`;
  - `LBlockCfg.sections`.
- Khối **Chi tiết bản ghi `K-RecordDetail`** thay khối Thông tin đơn hàng (trang Chi tiết đơn hàng). Đặt được trường gốc (khách hàng, mã đơn, nguồn đơn, người thực hiện, kho, chứng từ, số hóa đơn) và trường tùy chỉnh đầu đơn.
- Trang thiết kế mới **Form lên đơn bán**, khối **`K-RecordForm`**: điều khiển phần "Thông tin thêm" của form Lên đơn bán và của "Cập nhật thông tin" trên đơn. Có gợi ý trong ô, chú thích, chỉ đọc, bắt buộc riêng (khi lưu / trước khi duyệt).
- Trong Cài đặt khối:
  - thêm, xóa, đổi tên, đổi thứ tự nhóm; số cột của nhóm; thu gọn sẵn;
  - kéo trường bằng tay nắm để đổi thứ tự hoặc chuyển nhóm; kéo từ "Trường chưa đặt" vào nhóm (có cả nút ↑ ↓, + và ô chọn Nhóm cho bàn phím);
  - độ rộng: Cả hàng, 3/4, 2/3, 1/2, 1/3, 1/4, 1/6;
  - Hoàn tác / Làm lại áp dụng cho bố cục trường.
- **Bỏ trường khỏi bố cục chỉ ẩn hiển thị**, giá trị `cf[...]` trong đơn giữ nguyên. Không bỏ được trường gốc bắt buộc (khách hàng, mã đơn, người thực hiện, kho) và trường bắt buộc của form.
- Trường mới tạo (cờ "Form" / "Thông tin") tự vào nhóm cuối, như trước.
- Màn hẹp: trường giãn tối thiểu nửa hàng (máy tính bảng), cả hàng (điện thoại).
- **Kiểm tra khi duyệt** (Duyệt đơn tự duyệt, Hàng đợi duyệt, nhãn "Thiếu … để duyệt") theo định nghĩa trường cộng phần bắt buộc đặt riêng trong bố cục Form. Quy tắc không tự duyệt, định khoản `SALE_REVENUE` / `IN_SALE` và quy định lãi gộp không đổi.

**4. Tự chuyển bố cục cũ (`lMigrate`)**
- Khối `K-Order-Info` của bố cục V53 → V55.1 đã phát hành tự đọc thành `K-RecordDetail`: một nhóm không tiêu đề, giữ đúng thứ tự `fields`, trường tắt `off`, số cột `gridCols` (Khách hàng rộng gấp đôi). Trường tùy chỉnh có cờ "Thông tin" chưa có trong thứ tự cũ thêm cuối như trước.
- Kết quả cố định (id theo khóa), đọc lại nhiều lần vẫn như nhau. Không cần phát hành lại; lần lưu kế tiếp trong Studio mới ghi dạng mới.
- Form lên đơn chưa thiết kế: trường theo cờ "Form" như cũ (2 cột).

**Kiểm tra**: TypeScript không lỗi (kể cả strict). Chạy thử 33 / 33 mục đạt (`anh-v55.2/ket-qua-chay-thu.txt`):
- bố cục V54.1 đã phát hành (3 cột, tắt Nguồn chứng từ) hiển thị đúng thứ tự, đúng độ rộng;
- 3A mở thiết kế bằng URL, thêm nhóm "Vận chuyển", kéo trường sang nhóm, kéo đổi thứ tự, đổi nhãn "Kênh bán", bỏ "Số PO khách", Hoàn tác / Làm lại;
- tự lưu sau 2 giây, URL chuyển sang id bản nháp; tải lại vào đúng bản nháp; Back đóng màn thiết kế; phát hành;
- Form lên đơn: Biển số xe bắt buộc khi lưu, có gợi ý trong ô và chú thích; Số PO chỉ đọc; thiếu trường thì chặn lưu, đủ thì lưu được;
- chi tiết đơn theo bố cục mới; đơn cũ vẫn còn giá trị Số PO; báo thiếu trường để duyệt;
- đóng tab khi chưa lưu thì trình duyệt hỏi lại.

Chạy lại kịch bản V54.1 (thiết kế Quản lý đơn hàng, Tổng quan) và V55.1 (RLS, chuyển đơn, kho tệp, Lưu cho tôi) trên bản này: không lỗi.

**Lưu ý**
- Máy còn chạy bản v55.1 khi 3A phát hành bố cục mới: khối Thông tin đơn hàng hiện theo giao diện mặc định cho tới khi tải lại trang. Không mất dữ liệu.
- Trong khung thiết kế, khối giữ chiều cao đặt trên lưới nên nhóm trường dài có thể bị cắt; Xem trước và màn hình thật hiện đủ.
- Các trang Tổng quan (`TradingOverview`, `MktOverview`…) vẫn nằm trong `messenger.tsx`; tách ở chặng sau.

## (v55.1) 3A CRM v55.1 (Chặng 1: vá bảo mật nền tảng, lưu đơn bán từng bản ghi, kho tệp riêng tư, "Lưu cho tôi" theo người dùng — dựa trên v54.1, nhánh mới v55)

## Cập nhật v55.1 (22/11)

**Triển khai theo thứ tự**
1. Supabase › SQL Editor: chạy `supabase-v55.1.sql` (chạy lại nhiều lần vẫn an toàn, không sửa dữ liệu nghiệp vụ).
2. Deploy code v55.1 ngay sau đó (gộp nhánh `v55` vào `main`).
3. Báo mọi người **tải lại trang trên tất cả máy** (kể cả tab đang mở). Dữ liệu lên phiên bản 31: máy còn chạy bản cũ sẽ tự chuyển sang chỉ đọc, không ghi đè được.
4. Lần đầu sau khi deploy nên để Giám đốc / quản trị doanh nghiệp đăng nhập trước (chuyển đổi dữ liệu chạy ở máy người mở đầu tiên).

**1. Siết quyền đọc dữ liệu nền tảng (`_platform`)**
- Tài khoản doanh nghiệp chỉ đọc được 4 nhóm `layouts`, `layoutAssigns`, `customFields`, `industryProfiles`, và chỉ phần thuộc phạm vi của mình: cấp Toàn hệ thống, đúng mô hình (Thương mại / Xưởng) hoặc đúng mã doanh nghiệp. Bố cục bản nháp, bố cục / trường riêng của doanh nghiệp khác không còn đọc được.
- Chặn hoàn toàn `tenants` (danh sách doanh nghiệp, ghi chú nội bộ 3A) và `logs` (nhật ký nền tảng).
- RPC mới `get_my_tenant_info()`: trả hồ sơ các doanh nghiệp của chính tài khoản (module được bật, tạm dừng…), bỏ ghi chú nội bộ. App dùng RPC này khi đăng nhập và hỏi lại mỗi 60 giây, nên 3A bật / tắt module thì doanh nghiệp vẫn nhận được không cần tải lại trang.
- Quản trị 3A đọc / ghi như cũ.

**2. Đơn bán lưu từng bản ghi**
- `salesOrders` vào `KEYED_COLLS`: mỗi đơn một dòng theo `id` (trước đây cả danh sách đơn là một dòng JSON).
- Tự chuyển dữ liệu cũ khi mở: đọc dòng gộp cũ, ghi đủ từng đơn rồi mới đánh dấu xóa dòng gộp. Nếu một đơn đã có dòng riêng (bản mới hơn) thì giữ dòng riêng. Không mất đơn nào.

**3. Tệp đính kèm đơn hàng lên kho riêng tư `crm-attach`**
- Tệp mới tải lên Supabase Storage, thư mục `<mã doanh nghiệp>/sales/<mã đơn>/`; trong đơn chỉ lưu `{ id, name, url, size, mimeType }` (url dạng `attach:<đường dẫn>`), không còn base64 trong JSON. Tối đa 10 MB mỗi tệp (ảnh vẫn tự nén).
- Kho riêng tư: chỉ thành viên đúng doanh nghiệp (và quản trị 3A) mở / tải lên / xóa được; không có đường link công khai. Mở tệp: app tải bằng phiên đăng nhập rồi mở trong tab mới; nút tải về giữ đúng tên tệp.
- Bỏ tệp khỏi đơn thì xóa luôn tệp trong kho (nếu không còn dòng nào khác dùng chung).
- Tệp cũ đã nhúng base64 trong đơn vẫn mở / tải được như trước.

**4. "Lưu cho tôi" theo người dùng (làm trước cho Quản lý đơn hàng)**
- Kỳ xem, số đơn mỗi trang, bộ cột lưu vào dữ liệu doanh nghiệp, nhóm `userPrefs`, mỗi người một dòng theo mã nhân sự → đăng nhập máy khác vẫn giữ nguyên. Lựa chọn cũ trong trình duyệt được tự chép sang lần đầu.
- Mỗi người chỉ ghi được dòng của chính mình (quản trị doanh nghiệp ghi được mọi dòng). Các danh sách khác áp dụng ở Chặng 3.

**Kiểm tra**: TypeScript không lỗi (kể cả strict). SQL chạy thật trên PostgreSQL 16 với RLS. Chạy thử giao diện qua máy chủ giả lập Supabase dùng PostgreSQL thật (RLS, RPC, chính sách kho tệp đều thật): dữ liệu VASSH kiểu v54.1 (3 đơn trong một dòng gộp, một đơn đã có dòng riêng mới hơn, một đơn có tệp base64 cũ). Sales Bảo đăng nhập → 3 đơn thành 3 dòng, dòng gộp đánh dấu xóa, phiên bản 31, đơn -01 giữ bản mới hơn; Bảo không đọc được `tenants`, `logs`, bố cục ALUX, bản nháp; RPC chỉ trả VASSH, không có ghi chú; Bảo chọn Quý này, 50 / trang, bỏ cột Ghi chú → máy thứ hai nhận đúng; tài khoản ALUX không ghi được tùy chọn của Bảo. Tải lên PDF và tệp chữ: đơn chỉ lưu thông tin tệp, tệp nằm đúng thư mục, mở / tải về được; tệp base64 cũ vẫn mở được; ALUX không đọc / không tải lên được vào thư mục VASSH; không có link công khai; bỏ tệp thì xóa trong kho. Chạy lại kịch bản v54.1 ở chế độ máy đơn: không lỗi. Kết quả và ảnh ở thư mục `anh-v55.1`.

**Lưu ý còn lại (để các chặng sau)**
- Tài khoản là thành viên nhiều doanh nghiệp thấy phạm vi nền tảng của tất cả doanh nghiệp đó (theo tài khoản, chưa theo doanh nghiệp đang mở).
- Thành viên chưa gắn mã nhân sự (`app_user_id` trống) vẫn ghi được mọi dòng `userPrefs` để không gãy tài khoản cũ; nên gắn mã nhân sự cho đủ.
- Tệp đã lên bucket công khai `crm-files` từ các bản trước (ảnh nhúng lớn) vẫn công khai; chưa chuyển.
- Nếu một máy còn mở bản cũ và ghi đơn đúng lúc chuyển đổi, dòng gộp cũ có thể bị ghi lại; app vẫn ưu tiên dòng riêng, nhưng đơn đã xóa ở bản mới có thể hiện lại — vì vậy cần tải lại trang trên mọi máy (bước 3).
- Chuyển engine Page Builder sang `src/crm/modules/page-builder/` thuộc Chặng 2.

> Có SQL mới (`supabase-v55.1.sql`), không thêm bảng, không thêm thư viện. Cách hoàn tác ghi ở cuối file SQL.

## (v54.1) 3A CRM v54.1 (Page Builder bản 3.1: kiểu dáng cho mọi khối, khối Bảng Quản lý đơn hàng — dựa trên v54, vẫn nhánh v54)

## Cập nhật v54.1 (21/11)

- **Cài đặt khối chia 3 thẻ**: Nội dung · Kiểu · Hiển thị (vị trí, thiết bị, thuộc tab, điều kiện hiện).
- **Thẻ Kiểu cho mọi khối**: cỡ chữ (Nhỏ / Vừa / Lớn / Rất lớn), màu chữ; tiêu đề khối (cỡ, độ đậm, màu); nền (không nền, nền thẻ, nền chìm, 8 màu hệ thống hoặc mã # tự chọn; độ đậm Nhạt / Vừa / Đặc, nền đặc tự đổi chữ trắng / đen); viền (màu, Liền / Gạch / Chấm, dày 1–3); bo góc; đổ bóng; nút "Về mặc định". Màu hệ thống tự đổi theo nền sáng / tối.
- **Riêng từng loại**: biểu đồ chọn màu từng đường; bảng chọn mật độ dòng, sọc xen kẽ, nền dòng tiêu đề; tab chọn kiểu Gạch chân / Khối / Viên; đường kẻ chọn màu, kiểu, độ dày, màu nhãn; mỗi nút chọn màu riêng.
- **Khối Bảng (Danh sách đơn hàng)**, nguồn Đơn bán:
  - Đầu bảng: sửa tiêu đề trang (có biến {tên doanh nghiệp}, {ngày}, {người xem}) hoặc ẩn; bật / tắt ô tìm kiếm, chữ gợi ý, chọn trường tìm (mã đơn, khách hàng, SĐT, mã hàng, ghi chú, người tạo, MST, trường tùy chỉnh chữ / danh sách); ô chọn kỳ và kỳ mặc định (hoặc cố định kỳ); bật / tắt nút Bộ lọc, Cột hiển thị, Tải Excel, In, Lên đơn bán.
  - Bộ lọc: chọn trường được lọc; trường 3A tắt thì điều kiện cũ người dùng đã lưu cũng không áp.
  - Cột: thêm nhóm **Khách hàng ›** (mã KH, MST, SĐT, phòng ban phụ trách, khu vực, phân khúc, hạng, NV phụ trách, hạn mức, công nợ hiện tại) và **Người tạo ›** (phòng ban, chức danh); cột STT, ô chọn dòng; số dòng mỗi trang mặc định.
  - **Dòng tổng**: bật / tắt, chọn cột được cộng; trường tùy chỉnh kiểu Số / Tiền nay cũng được cộng.
  - Khung thiết kế hiện đúng tiêu đề, ô tìm, nút, cột và dòng tổng theo cấu hình.
- Sửa: bấm nhãn của nhóm nút chọn trong cài đặt kiểu không còn chọn nhầm ô đầu tiên.

**Kiểm tra**: TypeScript không lỗi (kể cả strict). Chạy thử: 3A đặt tiêu đề "Đơn hàng {tên doanh nghiệp}", thêm MST vào trường tìm, tắt nút In, tắt lọc Kho xuất / Hóa đơn thuế, bỏ cột Ghi chú / Hóa đơn thuế, thêm Mã khách hàng / Phòng ban phụ trách, không cộng VAT, bảng Gọn + sọc, tiêu đề cam cỡ lớn → phát hành. Tổng quan: thẻ Doanh số nền cam nhạt viền cam chữ lớn, Còn phải thu nền xanh đặc có bóng, biểu đồ xanh dương / xanh lá, ghi chú nền # tự chọn viền gạch xanh lá, tab kiểu Khối, đường kẻ cam dày 2, nút Lên đơn màu xanh → phát hành; xem cả nền sáng và nền tối. Sales thấy đúng tiêu đề "Đơn hàng VASSH", gợi ý tìm có MST, không có nút In, cột và dòng tổng đúng cấu hình, bộ lọc không còn Kho xuất / Hóa đơn thuế. Ảnh ở thư mục `anh-v54.1`.

> Không đổi bảng, SQL, không thêm thư viện. Kiểu dáng lưu trong cấu hình khối của bố cục (`_platform`) như v54; bố cục v54 đã phát hành giữ nguyên hiển thị.

## (v54) 3A CRM v54 (Page Builder bản 3: thư viện khối dùng chung, mở trang Quản lý đơn hàng — dựa trên v53)

## Cập nhật v54 (21/11)

- **Thư viện khối 3 tầng** (3A Platform › Thiết kế giao diện): *Khối hiển thị* dùng mọi trang (Khối text, Nút / Icon, Đường kẻ, Khoảng trống); *Khối dữ liệu* (Chỉ số, Biểu đồ, Bảng, Bộ lọc chung, Tab, Tiến độ mục tiêu); *Khối nghiệp vụ* riêng từng trang.
- **Khối text 8 kiểu**: Tiêu đề trang, Tiêu đề mục, Đoạn văn, Nhãn nhỏ, Ghi chú, Lưu ý, Cảnh báo, Trích dẫn; dòng phụ, căn trái / giữa / phải, cỡ chữ, khung. **Biến tự điền**: {kỳ}, {kỳ trước}, {giờ cập nhật}, {kỳ vọng %}, {số ngày còn lại}, {ngày}, {tên doanh nghiệp}, {người xem}; trang đơn thêm {mã đơn}, {khách hàng}, {trạng thái đơn}.
- **Nút / Icon**: mỗi nút tự chọn icon (~30), nhãn, kiểu (Chỉ icon / Viền / Chỉ chữ cho nút phụ / Nút chính), hành động. Chọn *Mở trang trong CRM* thì chọn trang đích; *Liên kết ngoài* thì nhập URL (chỉ https). Nút người xem không có quyền tự ẩn.
- **Bộ lọc chung** (Tổng quan): kỳ Tuần / Tháng / Quý / Năm, so với kỳ trước, phòng ban (theo quyền xem). Các khối Chỉ số, Biểu đồ, Bảng, Tiến độ đi theo bộ lọc.
- **Tab**: mỗi tab một nhóm khối; tab mà người xem không có quyền với mọi khối bên trong thì tự ẩn. Đổi tab **giữ nguyên kỳ và phòng ban** đã chọn.
- **Tiến độ mục tiêu**: doanh thu so với chỉ tiêu, vạch kỳ vọng; chưa có chỉ tiêu thì hiện lời nhắc và nút Nhập chỉ tiêu.
- **Trang Quản lý đơn hàng** mở cho thiết kế: khối lõi Danh sách đơn (3A đặt thứ tự / ẩn tab trạng thái và bộ cột mặc định cho doanh nghiệp; mỗi người vẫn tự đổi cột riêng) + khối hiển thị phía trên / dưới.
- **Tự chuyển bố cục v53**: Khối text kiểu cũ và Nút biểu tượng (K-Icons) đã phát hành tự đổi sang dạng mới khi mở, giữ nguyên vị trí và nút.

**Kiểm tra**: TypeScript không lỗi (kể cả strict). Chạy thử: bố cục trang đơn v53 đã phát hành tự chuyển sang nút mới; 3A thiết kế Tổng quan 3 tab (Tổng quan / Kinh doanh / Tài chính) với tiêu đề có biến, bộ lọc chung, nút Chỉ tiêu / PDF / Đơn hàng (Chỉ chữ, mở trang Bán hàng), xem trước Sales trên điện thoại rồi phát hành; thiết kế Quản lý đơn hàng (thêm khối text, ẩn tab Đã thanh toán / Đã hủy, bỏ cột Ghi chú, thêm cột Người tạo) rồi phát hành. Giám đốc chọn Quý, đổi tab vẫn giữ Quý; mở Nhập chỉ tiêu từ khối. Sales chỉ thấy tab Tổng quan và Kinh doanh. Ảnh ở thư mục `anh-v54`.

> Không đổi bảng, SQL, không thêm thư viện. Bố cục vẫn lưu trong kho dữ liệu nền tảng `_platform` như v53. Khối Ảnh / Logo để bản 4 (cùng kho tệp Supabase Storage).

## (v53) 3A CRM v53 (Page Builder bản 2: trang Chi tiết đơn hàng theo khối, khối text, nút biểu tượng, trường tùy chỉnh đơn bán — dựa trên v52)

## Cập nhật v53 (20/11)

- **Trang Chi tiết đơn hàng dựng bằng khối** (3A Platform › Thiết kế giao diện › Trang). Khối lõi khóa (không xóa, luôn hiện): Thông tin đơn hàng, Hàng hóa & chứng từ, Quy trình xử lý, Thanh toán. Khối thêm: Lãi trên đơn, Công nợ khách, Trao đổi & nhật ký, Giao hàng & ghi chú, Tệp đính kèm. Chưa phát hành thì doanh nghiệp dùng giao diện gốc như cũ.
- **Khối text** (cả Tổng quan và trang đơn): **đậm**, *nghiêng*, danh sách, tiêu đề nhỏ, liên kết; khung Thường / Lưu ý / Cảnh báo; hiện theo trạng thái đơn và vai trò. Không dùng HTML.
- **Nút biểu tượng**: Quay lại, Đơn trước / Đơn sau, In, Tải xuống Excel, Tải lên tệp đính kèm, Xổ xuống (Sửa / Hủy / Xóa đơn theo quyền). Trang Tổng quan: In, Tải số liệu các khối ra Excel.
- **Trường tùy chỉnh đơn bán** (3A Platform › Thiết kế giao diện › Trường tùy chỉnh): đầu đơn hoặc dòng hàng; kiểu Chữ, Số, Tiền, Ngày, Danh sách chọn, Người dùng, Tích chọn; bắt buộc khi lưu / khi duyệt; áp dụng Toàn hệ thống / Mô hình / Riêng doanh nghiệp; hiện ở form lên đơn, khối Thông tin, cột và bộ lọc Quản lý đơn hàng. Giá trị lưu trong đơn của doanh nghiệp (không thêm bảng, vẫn qua RLS). Trường dòng hàng chỉ để ghi chú, không tính tiền.
- **Bảng**: cột STT; trên điện thoại bảng thu gọn và bảng Hàng hóa tự chuyển dạng thẻ.
- **Xem trước** trang đơn hàng theo vai trò và trạng thái đơn mẫu (Chờ duyệt / Chờ xuất kho / Chờ thu tiền / Đang hủy / Hoàn thành).
- Tệp đính kèm lưu ngay trong đơn (ảnh tự nén; PDF, Word, Excel tối đa 2 MB; tối đa 10 tệp/đơn).

**Kiểm tra**: TypeScript không lỗi (kể cả strict). Chạy thử: 3A tạo trường "Hình thức vận chuyển" (bắt buộc khi duyệt, Mô hình Thương mại, có lọc) → thiết kế trang đơn hàng (thêm Nút biểu tượng, Khối text có điều kiện, Tệp đính kèm, Giao hàng; tắt cột Trả lại) → xem trước Kế toán trên điện thoại, Sales khi đơn đang hủy → phát hành. Sales lên đơn có Thông tin thêm; đơn thiếu trường bị chặn duyệt, cập nhật thông tin xong duyệt được; tải lên tệp, tải Excel, đơn trước / sau; danh sách bật cột và lọc theo trường. Kế toán thấy Lãi trên đơn. Ảnh ở thư mục `anh-v53`.


> Không đổi bảng, SQL, không thêm thư viện. Mẫu bố cục lưu trong kho dữ liệu nền tảng `_platform` (2 danh sách mới `layouts`, `layoutAssigns`), cùng chỗ với hồ sơ doanh nghiệp: chỉ quản trị 3A ghi, doanh nghiệp chỉ đọc (theo chính sách RLS hiện có).

## Cập nhật v52 (20/11)
1. **3A Platform › Thiết kế giao diện** (chỉ tài khoản quản trị 3A): danh sách trang (Tổng quan mở ở bản này; Bàn làm việc, Báo cáo, trang nghiệp vụ ghi "Bản 2 / Bản sau"), cột phiên bản đang áp dụng theo cấp Toàn hệ thống / Thương mại / Xưởng / Riêng doanh nghiệp; mỗi dòng có nút **Thiết kế** và **Phát hành**.
2. **Màn thiết kế** toàn màn hình (ẩn thanh điều hướng, có ← Quay lại; quay lại khi còn thay đổi thì tự lưu nháp): thư viện khối (3 khối dùng được; các khối khác gom ở mục "Bản sau"), lưới 12 cột: kéo khối bằng tay nắm, kéo góc phải dưới đổi độ rộng 1–12 / chiều cao, thêm khối bằng bấm hoặc kéo từ thư viện, nhân bản, xóa, Hoàn tác / Làm lại; khối tự dồn lên, không chồng nhau. Dữ liệu mẫu, không đọc dữ liệu doanh nghiệp.
3. **Cài đặt khối**: tiêu đề, nguồn dữ liệu (Đơn bán, Lead, Khách hàng, Thu chi, Chương trình MDF), lọc, chỉ tiêu, cách tính (Tổng / Đếm / Trung bình), kỳ, so sánh kỳ trước; biểu đồ 2 đường 6 / 12 tháng; bảng thu gọn dạng danh sách (≤ 5 cột) hoặc nhóm theo (VD Top 5 khách hàng); nút mở phân hệ; vị trí cột / hàng / rộng / cao; **hiển thị trên Máy tính / Tablet / Điện thoại**; **độ rộng trên điện thoại** Cả hàng / 1/2 / 1/3 / 1/4 (khối chỉ số xếp lưới 2 × 2).
4. **Xem trước**: chọn thiết bị (máy tính 12 cột, tablet 6 cột, điện thoại theo độ rộng khối) và **vai trò** (Giám đốc, Trưởng phòng, Sales, Trưởng MKT, Kế toán) để thấy khối tự ẩn theo quyền mặc định; ngăn kiểm tra trước khi phát hành; danh sách khối trên từng thiết bị (bật / tắt, kéo đổi thứ tự trên điện thoại).
5. **Phát hành** (ngăn phải, tab Phát hành / Lịch sử): tick Toàn hệ thống / Mô hình Thương mại / Mô hình Xưởng / Riêng doanh nghiệp, phát hành thử cho 1 doanh nghiệp, ghi chú phiên bản, danh sách đang áp dụng có nút Gỡ; Lịch sử phiên bản có Khôi phục (chép thành bản nháp). Mọi thao tác ghi nhật ký nền tảng.
6. **Phía doanh nghiệp**: trang Tổng quan hiện bố cục đã phát hành (ưu tiên riêng doanh nghiệp → mô hình → toàn hệ thống), chưa phát hành thì giữ giao diện gốc; không có nút sửa, kể cả Giám đốc. Số liệu theo phạm vi xem của người đăng nhập; khối thuộc phân hệ / quyền người đó không có thì tự ẩn; tự xếp lại theo bề rộng màn hình.
7. **Schema JSON**: `LayoutVer { id, schema: 1, page, version, status: DRAFT | PUBLISHED, role (null = mọi vai trò; để dành tách theo vai trò), blocks[], note, by, at }`; `LBlock { id, type, pos: { lg: { x, y, w, h }, sm: { w, order } }, show: { lg, md, sm }, config }`; `LayoutAssign { page, level: SYSTEM | PROFILE | TENANT, profile, tenantId, role, verId }`. Vị trí x / y / w / h cùng định dạng react-grid-layout.

**Kiểm tra**: TypeScript không lỗi (kể cả strict). Chạy thử: quản trị 3A mở Thiết kế Tổng quan → đổi tiêu đề, kéo khối, kéo góc đổi cỡ, thêm khối bằng bấm và kéo thả, hoàn tác / làm lại → xem trước điện thoại và tablet với vai trò Sales → phát hành Toàn hệ thống → Lịch sử; đăng nhập Sales và Giám đốc VASSH thấy bố cục mới, màn điện thoại xếp 2 cột cho khối chỉ số. Chạy lại luồng đơn hàng v50 không lỗi. Ảnh ở thư mục `anh-v52`.
**Giới hạn**: lưới kéo thả tự viết thay cho `react-grid-layout` vì môi trường build của 3A lần này không tải được gói npm để kiểm thử; dữ liệu cùng định dạng nên đổi sang thư viện sau không phải chuyển dữ liệu. Bản 1 chỉ áp dụng trang Tổng quan và 3 khối; vai trò khi xem trước dùng phân quyền mặc định (khi chạy thật theo phân quyền thật của doanh nghiệp). Mọi thành viên doanh nghiệp đọc được mẫu bố cục của nền tảng (không chứa dữ liệu nghiệp vụ).

## (v51.3) 3A CRM v51.3 (hệ thống tài khoản TT 99 / TT 133, định khoản tự động, lãi đơn hàng — dựa trên v51.2)

> Không đổi bảng, SQL, không thêm thư viện. Cấu hình kế toán lưu trong cấu hình doanh nghiệp sẵn có (khóa `mfgConfig.acct`); phiếu quỹ thêm trường tùy chọn phân bổ chi phí.

## Cập nhật v51.3 (20/11)
1. **Chế độ kế toán** (Cài đặt › Hệ thống tài khoản): chọn bộ tài khoản **TT 99/2025/TT-BTC** hoặc **TT 133/2016/TT-BTC**, khóa trong năm tài chính (01/01–31/12), đổi được từ năm sau. Danh mục tài khoản đối chiếu phụ lục của từng thông tư; kế toán thêm tài khoản chi tiết (cấp 2, 3…) dưới tài khoản cha (số hiệu bắt đầu bằng số hiệu cha), xóa được tài khoản chi tiết chưa dùng; tài khoản của thông tư không sửa / xóa.
2. **Định khoản tự động theo sự kiện kinh tế**: thu tiền khách, thu hoàn ứng, thu khác, chi phí (tách thuế GTGT đầu vào khi có hóa đơn), trả nhà cung cấp, tạm ứng, hoàn tiền khách, chuyển quỹ, doanh thu + thuế đầu ra + giá vốn khi kho duyệt xuất bán, hàng bán bị trả lại. Mỗi sự kiện có cặp Nợ / Có sửa được; tài khoản quỹ, thuế; bảng **khoản mục thu chi → tài khoản** (khoản mục chưa gán được nhắc). Mặc định theo thông tư (VD chi phí vận chuyển: 6417 theo TT 99, 6421 theo TT 133). Có **Sổ nhật ký** (xuất CSV) và **Bảng cân đối số phát sinh** theo kỳ.
3. **Khung Hạch toán (Nợ / Có)** ở phiếu thu, phiếu chi, chuyển quỹ (hiện trước khi lưu) và ở bản xem phiếu.
4. **Lãi trên đơn** (chi tiết đơn, người có quyền quản lý bán hàng / kế toán / Giám đốc): Doanh thu thuần (sau chiết khấu, trừ hàng trả lại, chưa VAT) − Giá vốn tạm tính = **Lãi gộp chuẩn**; trừ chi phí gắn vào đơn (chưa gồm thuế được khấu trừ) = **Lãi ước tính**. Phiếu chi gắn đơn vẫn hạch toán vào tài khoản chi phí của khoản mục, kèm mã đơn.
5. **Một phiếu chi cho nhiều đơn**: "Tính vào chi phí của › Nhiều đơn bán (phân bổ)", chọn đơn, phân bổ theo doanh thu / số lượng / chia đều; cột phải hiện lãi ước tính từng đơn trước → sau.
6. **Giao diện Thu chi theo ảnh mẫu**: thanh công cụ (tìm kiếm, nút lọc gom khoản mục / đối tượng / loại phiếu, tải CSV, Chuyển quỹ / Phiếu thu / Phiếu chi); thẻ sổ gồm tab, chọn sổ có số dư, dòng Đầu kỳ + Thu − Chi = Cuối kỳ, bảng có cột Nguồn (mã chứng từ gốc), Trạng thái, cột thao tác (xem / sửa, in, hủy phiếu); cột Diễn giải ẩn mặc định (bật ở nút chọn cột).
7. **Phiếu thu**: thêm **Thu hoàn ứng** (chọn nhân viên, hiện số tạm ứng đang giữ trước / sau); chọn khách dạng thẻ (MST, còn nợ). **Phiếu chi**: chọn người nhận dạng thẻ (nhà cung cấp / nhân viên / khách, SĐT). **Chuyển quỹ**: thẻ quỹ có tên ngân hàng / số tài khoản (theo Cài đặt › Doanh nghiệp), mã phiếu CQ ở phần Ghi vào sổ, "In giấy rút tiền" khi rút từ ngân hàng; phí chuyển ghi khoản mục "Phí ngân hàng".
8. **Hủy đơn theo ảnh mẫu**: thẻ hủy nằm cột trái cùng bảng chứng từ (tự mở tab Chứng từ, thêm dòng "Phiếu chi hoàn tiền · Cần lập"); cột phải Thanh toán (có "Khách trả thừa") và **Quy trình hủy**; ẩn các nút thu tiền / xuất kho / hóa đơn khi đang hủy.

**Kiểm tra**: TypeScript không lỗi (kể cả strict). Chạy thử: chọn TT 99 → phiếu thu 2 đơn (Nợ 111 / Có 131) → hủy phiếu (phiếu đảo) → chuyển quỹ có phí (Nợ 111, Nợ 6427 / Có 112) → phiếu chi 600.000 có hóa đơn 8% phân bổ 2 đơn (Nợ 152 555.556, Nợ 1331 44.444 / Có 111; mỗi đơn chịu 277.778) → bảng cân đối số phát sinh tổng Nợ = tổng Có → nhập trả, hoàn tiền ở Phiếu chi › Hoàn tiền khách → hủy đơn. Chạy lại luồng đơn hàng v50, v51 không lỗi; xem được ở giao diện tối. Ảnh ở thư mục `anh-v51-3`.
**Giới hạn**: Báo cáo tình hình tài chính (B01) và Kết quả kinh doanh (B02) theo mẫu từng thông tư chưa làm (cần thêm bút toán mua hàng, lương, khấu hao, số dư đầu kỳ các tài khoản). Giá vốn là tạm tính theo giá vốn hiện tại của mã hàng, chưa tự cập nhật theo bình quân cuối kỳ. Chưa có phân bổ theo trọng lượng (mã hàng chưa có trường trọng lượng). Năm tài chính tính theo năm dương lịch.

## (v51.2) 3A CRM v51.2 (Thu chi nâng cấp, hủy đơn đã có chứng từ — dựa trên v51.1)

> Không đổi bảng, SQL, không thêm thư viện. Phiếu quỹ thêm vài trường tùy chọn (phiếu đảo, các khoản thu gộp, đơn chịu chi phí, hóa đơn đầu vào, chứng từ kèm); dữ liệu cũ đọc như trước.

## Cập nhật v51.2 (20/11)
1. **Sổ thu chi**: thay 4 thẻ số liệu bằng một dòng Đầu kỳ + Thu − Chi = Cuối kỳ. Sổ chi tiết có thêm cột **Nguồn** (Đơn hàng kèm mã đơn, Lập tay, Kho, Hoa hồng, Công tác phí, Phiếu đảo, Chuyển quỹ…) và **Trạng thái** (Hiệu lực / Đã hủy / Hủy một phần / Phiếu đảo). Phiếu đã hủy hiện mờ, số phiếu gạch ngang. Bỏ đoạn ghi chú dài cuối bảng.
2. **Bấm phiếu tự sinh ngay trong Thu chi** mở bản xem: bản in phiếu, Chứng từ gốc (bấm Mở để sang đơn hàng / đơn xưởng), số tiền và quỹ khóa, sửa được Ngày chứng từ và Diễn giải (đồng bộ ngày vào khoản thu trên đơn). Phiếu thu / chi của đơn hàng có **Hủy phiếu** (bắt buộc lý do): sinh phiếu đảo, gỡ khoản thu khỏi đơn (đơn quay về còn phải thu). Phiếu tự sinh từ nghiệp vụ khác hướng dẫn hủy ở chứng từ gốc. Phiếu lập tay vẫn sửa / xóa như cũ.
3. **Phiếu thu** (khung rộng 2 cột): loại Thu tiền khách hàng / Thu khác. Thu tiền khách: chọn khách → hiện các đơn còn phải thu; tick đơn, nhập số thu từng đơn hoặc nhập tổng rồi "Phân bổ cho đơn cũ trước"; một phiếu thu cho nhiều đơn, các đơn ghi nhận doanh thu ngay. Cột phải: công nợ khách trước / sau, tồn quỹ trước / sau. Số tiền bằng chữ, chứng từ kèm (ảnh, PDF ≤ 1 MB), In phiếu sau khi lưu, Lưu và thêm mới.
4. **Phiếu chi**: loại Chi phí / Trả nhà cung cấp / Tạm ứng / Hoàn tiền khách. Chi phí tính vào đơn bán hoặc đơn xưởng (cột phải hiện chi phí đã tính của đơn trước / sau). Hóa đơn đầu vào: số hóa đơn, thuế suất, tiền thuế tự tính. Hoàn tiền khách: chọn khách → các đơn đang trả thừa (kể cả đơn đã hủy), hoàn theo từng đơn. Cảnh báo khi quỹ âm sau khi chi.
5. **Chuyển quỹ**: hai thẻ Từ quỹ / Sang quỹ với số dư trước → sau, nút đổi chiều; một phiếu CQ hiện ở cả hai sổ; nhập **Phí chuyển** thì tự lập thêm phiếu chi từ quỹ nguồn.
6. **Hủy đơn đã có chứng từ** (không xóa): menu ⋯ › Hủy đơn mở bảng kiểm tra: hàng đã xuất phải nhập trả đủ (nút **Lập phiếu nhập trả** gửi kho duyệt), tiền khách đã trả phải hoàn đủ (nút **Lập phiếu chi hoàn tiền**, chọn tiền mặt / chuyển khoản; nhân viên không phải kế toán thì là Đề nghị hoàn tiền chờ kế toán xác nhận), hóa đơn đã xuất nhắc lập hóa đơn điều chỉnh, phiếu xuất chờ kho được hủy kèm, yêu cầu hóa đơn đang chờ được trả lại. Đủ điều kiện mới bấm Hủy đơn (bắt buộc lý do); đơn đóng lại, giữ toàn bộ chứng từ.
7. **Đơn đã hủy**: số phải thu = 0, tiền khách đã trả thành tiền phải hoàn; trong đơn có nút "Hoàn tiền khách". Menu Xóa đơn ghi đúng lý do: "đã xuất kho, dùng Hủy đơn" / "đã có phiếu thu, dùng Hủy đơn".

**Kiểm tra**: TypeScript không lỗi (kể cả strict). Chạy thử: 2 đơn của cùng khách → kho xuất → kế toán lập 1 phiếu thu cho 2 đơn → bấm phiếu trong Thu chi, hủy → sinh phiếu đảo, 2 đơn quay về chưa thu; chuyển quỹ có phí → thêm phiếu chi phí; đơn đã thu tiền: lập phiếu nhập trả → kho duyệt → kế toán hoàn tiền ở Phiếu chi › Hoàn tiền khách → người lên đơn hủy đơn thành công. Chạy lại luồng đơn hàng v50 không lỗi. Ảnh ở thư mục `anh-v51-2`.
**Giới hạn**: khung Hạch toán (Nợ / Có) trong ảnh mẫu chưa làm vì cần chốt hệ thống tài khoản; chứng từ kèm lưu trong dữ liệu phiếu (ảnh được nén) nên giới hạn 6 tệp / phiếu.

## (v51) 3A CRM v51 (phân quyền theo tác vụ: Truy cập · Thêm mới · Sửa · Xóa · Duyệt · Thanh toán · Xem tất cả — dựa trên v50.2)

> Không đổi bảng, SQL, không thêm thư viện. Ma trận dùng chính dữ liệu phân quyền cũ (phân hệ, thao tác, phạm vi, ngoại lệ tài khoản), chỉ thêm 9 quyền mới; cấu hình cũ giữ nguyên.

## Sửa v51.1 (20/11)
1. **Nhóm Giám đốc không khóa**: cấu hình từng ô như nhóm khác; chỉ giữ cố định quyền vào và sửa Cài đặt của Giám đốc để không tự khóa mình. Quyền Giám đốc giờ đọc đúng theo ma trận (bỏ ép toàn quyền).
2. **Xóa đơn hàng**: người có quyền "Đơn hàng bán · Xóa" xóa được đơn chưa xuất kho và chưa có phiếu thu đã xác nhận (không cần hủy trước); phiếu xuất đang chờ kho được hủy theo; có Hoàn tác. Khi không xóa được, menu ghi rõ lý do (chưa có quyền / đã xuất kho / đã có phiếu thu). Trước đây chỉ xóa được đơn đã hủy nên bấm không có tác dụng.
3. **Yêu cầu xuất hóa đơn** mở bảng riêng: thông tin xuất hóa đơn (tên đơn vị, MST, người mua, địa chỉ, email nhận hóa đơn) tự điền từ hồ sơ khách hàng / đơn; thiếu thì bắt buộc nhập (MST 10 hoặc 13 số, hoặc chọn khách cá nhân không MST; email hợp lệ); hàng hóa kế thừa từ đơn: chọn dòng, số lượng (không vượt phần chưa xuất hóa đơn), đổi tên hàng trên hóa đơn; tự tính tiền hàng, VAT, tổng; tùy chọn lưu thông tin vào hồ sơ khách. Kế toán thấy đủ thông tin người mua và hàng hóa khi xử lý; bản xem chứng từ có đủ các thông tin này.

## Cập nhật v51 (20/11)
1. **Cài đặt › Phân quyền làm lại**: cột trái là nhóm quyền dạng cây (Giám đốc, Trưởng MKT, Trưởng phòng › Nhân viên KD, Kế toán) kèm số tài khoản, lối vào Ngoại lệ từng tài khoản và Nhật ký thay đổi. Đầu trang: thành viên nhóm, phạm vi dữ liệu. Tab Ma trận quyền / Người dùng / Nhật ký thay đổi.
2. **Ma trận chức năng × 7 tác vụ**: mỗi ô gắn với quyền thật (bật phân hệ hoặc một thao tác cụ thể); ô không áp dụng gạch mờ; tắt Truy cập thì cả dòng khóa; bật / tắt cả cột ở tiêu đề; tìm chức năng; sao chép quyền từ nhóm khác. Thao tác cũ chưa có ô riêng tự hiện thành dòng con trong phân hệ của nó.
3. **Sửa nháp rồi Lưu**: thanh dưới cùng đếm thay đổi chưa lưu, Bỏ thay đổi / Lưu phân quyền; mỗi thay đổi ghi nhật ký.
4. **Quyền riêng từng tài khoản** ở tab Người dùng: đổi phạm vi dữ liệu, bấm tên để mở ma trận của người đó (ô viền cam là khác nhóm), Đưa về theo nhóm.
6. **Quyền mới**: Lên đơn bán; Duyệt đơn trong ngưỡng; Xem tất cả đơn / khách hàng / lead (bỏ qua phạm vi dữ liệu theo từng chức năng); Xóa khách hàng (tách khỏi Sửa); Xóa đơn xưởng, lệnh sản xuất, lịch lắp đặt.
7. **Thêm thao tác ở danh sách** (chế độ xưởng): Lệnh sản xuất (xem / sửa, xóa lệnh chưa làm và chưa có lịch lắp), Lắp đặt (xem / sửa, xóa lịch chưa nghiệm thu), Đơn xưởng (xem / sửa, xóa đơn chưa có phiếu thu / lệnh sản xuất); xóa có Hoàn tác.

**Kiểm tra**: TypeScript không lỗi (kể cả strict); chạy thử: Giám đốc tắt "Đơn hàng bán · Thêm mới" và bật "Khách hàng · Xem tất cả" cho Nhân viên KD, lưu → Hà không còn nút Lên đơn bán, thấy mọi khách hàng; cấp riêng "Thêm mới" cho Bảo → Bảo vẫn lên đơn được; nhật ký ghi thay đổi. Chạy lại toàn bộ luồng đơn hàng v50.1 không lỗi. Ảnh ở thư mục `anh-v51`.
**Giới hạn**: nhóm quyền là 5 vai trò sẵn có (chưa tạo nhóm tùy ý như Kho vận, Kỹ thuật dự án; dùng quyền riêng từng tài khoản để thay); thao tác xóa ở Xưởng / Sản xuất / Lắp đặt mới kiểm tra bằng TypeScript, chưa chạy thử trên doanh nghiệp chế độ xưởng; phạm vi xem vẫn lọc ở giao diện như v50.2.

## Sửa v50.2 (20/11, phân quyền đơn hàng)
1. **Đơn đã hoàn thành vẫn cập nhật được thông tin** (nguồn đơn, nguồn chứng từ, người thực hiện, người nhận, SĐT, ngày / địa chỉ giao, ghi chú, khách lấy hóa đơn) bằng nút "Cập nhật thông tin" ở khối Thông tin đơn hàng; không đổi hàng hóa, giá; ghi vào nhật ký đơn. Yêu cầu xuất hóa đơn gửi được cả khi đơn đã hoàn thành (và cả đơn trước đó chọn không lấy hóa đơn).
2. **Chứng từ liên quan chỉ xem**: bấm dòng chứng từ mở bản xem dạng file (phiếu xuất / nhập trả, phiếu thu / chi, yêu cầu hóa đơn, đặt hàng), có In / lưu PDF. Nút "Sửa chứng từ" chỉ hiện với Giám đốc và người có quyền "Bán hàng: sửa / hủy chứng từ liên quan" (mặc định Kế toán). Hủy phiếu thu của đơn cũng theo quyền này.
3. **Phân quyền chi tiết** ở Cài đặt › Phân quyền, nhóm Bán hàng: sửa hàng hóa / hủy đơn của người khác; cập nhật thông tin đơn của người khác; xóa đơn đã hủy; sửa / hủy chứng từ liên quan. Giám đốc luôn có toàn quyền.
4. **Phạm vi xem đơn** theo "Phạm vi dữ liệu" (vai trò hoặc từng tài khoản, do Giám đốc cấp): Chỉ của mình = đơn mình lên; Phòng ban = đơn của người cùng phòng; Toàn doanh nghiệp = mọi đơn. Kế toán xem mọi đơn để thu tiền, xuất hóa đơn. Người đang phải duyệt đơn / duyệt kho vẫn mở được đơn đó; đơn ngoài phạm vi hiện thông báo không có quyền. Lưu ý: phạm vi xem đơn đang lọc ở giao diện; dữ liệu giữa các doanh nghiệp vẫn tách bằng RLS như cũ, nhưng máy chủ chưa chặn theo từng đơn trong cùng doanh nghiệp.

## Sửa luồng v50.1 (20/11, sau góp ý)
1. **Lưu đơn chỉ ghi nhận doanh số**: không còn tự sinh phiếu xuất kho, không tự sinh phiếu thu (bỏ "Khách trả trước" và "gửi xuất kho ngay" trên form). Luồng: Lưu đơn → Duyệt → Yêu cầu xuất kho (bấm tay) → kho Duyệt / Từ chối → kế toán lập / xác nhận phiếu thu.
2. **Duyệt đơn luôn là một bước**: đơn chạm điều kiện quy trình "Đơn bán" thì chờ người duyệt theo quy trình (có báo); đơn trong ngưỡng thì người lên đơn (hoặc Giám đốc / người có quyền) bấm Duyệt đơn.
3. **Doanh thu = tiền kế toán đã thu**: danh sách đổi cột thành Doanh số (trước VAT) · VAT · Tổng đơn · Doanh thu (phiếu thu kế toán đã xác nhận) · Còn lại; thêm cột tùy chọn "Chờ kế toán thu". Nhân viên không phải kế toán chỉ "Báo đã nhận tiền" (chờ kế toán xác nhận); kế toán "Lập phiếu thu" thì vào quỹ ngay.
4. **Phiếu kho**: danh sách phiếu có cột Thao tác (Duyệt / Từ chối) cho người có quyền duyệt; trong phiếu có nút Từ chối (bắt buộc lý do), báo người lập phiếu / người lên đơn; đơn trở về "Đã duyệt" để gửi lại. Giám đốc duyệt được cả phiếu do mình lập.
5. **Quyền mới "Bán hàng: sửa, hủy, xóa đơn"** (Cài đặt › Phân quyền; mặc định Giám đốc, Trưởng phòng; Giám đốc luôn có): menu ⋯ ở từng dòng đơn và trong đơn: Sửa đơn (khi chưa xuất kho, sửa xong phải duyệt lại), Hủy đơn (hủy luôn phiếu xuất đang chờ kho), Xóa đơn (đơn đã hủy, chưa có phiếu thu, có Hoàn tác). Người lên đơn sửa / hủy được đơn của mình. Hủy phiếu thu của đơn (Giám đốc / kế toán / quyền trên): phiếu đã vào quỹ thì sinh phiếu đảo, giữ lịch sử sổ quỹ.

## Cập nhật v50 (20/11)
1. **Danh sách đơn hàng**: tiêu đề "Quản lý đơn hàng", ô tìm kiếm ở giữa, chọn thời gian (Tất cả, Hôm nay … Năm nay, Thời gian khác có Từ / Đến ngày + Áp dụng), nút bộ lọc mở khung 2 cột (theo ngày đặt / ngày tạo, mã đơn, nguồn đơn, NV bán, khách, kho, trạng thái xuất kho, phương thức / trạng thái thanh toán, hóa đơn thuế, doanh thu lớn hơn / nhỏ hơn, có hàng trả lại, quá hạn), nút chọn cột theo 3 nhóm (cột cố định có khóa, Mặc định, Lưu cho tôi), xuất CSV / in (đơn đã chọn hoặc cả danh sách), Lên đơn bán (phím N). Tab Tất cả / Chờ duyệt / Đã duyệt / Chờ xuất kho / Chưa thanh toán / Đã thanh toán / Hoàn thành / Đã hủy nằm cùng hàng với phân trang 20 / 50 / 100. Mã đơn 2 dòng (mã / NV bán), dòng tổng theo bộ lọc.
2. **Mã đơn mới** dạng `DHddmmyy-NN` (vd. DH201126-01); có thể tự nhập khi tạo đơn (kiểm tra trùng).
3. **Tạo đơn hàng**: 2 cột. Thông tin đơn hàng (khách + nút thêm khách mới, mã đơn, nguồn đơn, người thực hiện, kho xuất, nguồn chứng từ, số hóa đơn thuế do kế toán nhập); bảng Hàng hóa nhập trực tiếp từng ô (mã / tên chọn từ danh mục, tồn kho, SL, đơn giá, CK%, CK đồng, VAT%); Giao hàng & ghi chú. Cột phải: Quy trình xử lý (báo trước đơn có cần duyệt và lý do), Thanh toán (tiền mặt / chuyển khoản / công nợ + trả trước), Công nợ khách. Nút Gửi duyệt / Lưu đơn (F9), Lưu nháp.
4. **Chi tiết đơn**: bỏ thanh bước trên cùng; tab Hàng hóa (bảng như tạo đơn + Đã xuất / Trả lại / Còn phải xuất) và Chứng từ liên quan (phiếu xuất / nhập trả, phiếu thu, hóa đơn, đặt hàng NCC, lệnh sản xuất; lọc Kho / Thu chi / Hóa đơn); Trao đổi & nhật ký (ghi trao đổi trên đơn + nhật ký hệ thống). Cột phải: Quy trình xử lý (hóa đơn, thanh toán chạy song song), Thanh toán + lịch sử thu chi, Công nợ khách.
5. **Trang Duyệt đơn** (riêng, mở từ chi tiết đơn): đi lần lượt các đơn chờ mình duyệt; bảng Kiểm tra trước khi duyệt (điều kiện quy trình, chiết khấu, tồn khả dụng, hạn mức công nợ, giao hàng, giá bán so với giá vốn) phải đánh dấu đã xem các điểm cần lưu ý mới duyệt được; Từ chối / Yêu cầu bổ sung bắt buộc ý kiến; cột phải quy trình duyệt nhiều bước, CRM 3A phân tích thói quen trả tiền, thanh toán, công nợ.
6. **Trang Ghi thu** (riêng): khách trả / hoàn tiền (khi khách trả thừa), ngày thu, tiền mặt / chuyển khoản, tài khoản nhận, người nộp, số tiền (Thu đủ / 50%), gắn hóa đơn thuế, ghi chú; Lưu hoặc Lưu & in phiếu; lịch sử thu chi của đơn (xác nhận, in lại phiếu). Kế toán lưu là vào quỹ ngay; nhân viên khác lưu thì chờ kế toán xác nhận.

**Kiểm tra**: TypeScript không lỗi (kể cả strict); chạy thử trên trình duyệt: NV kinh doanh tạo đơn 2 dòng (CK 15% → Gửi duyệt) → Trưởng phòng mở trang Duyệt đơn, đánh dấu các điểm cần xem, duyệt → NV gửi yêu cầu xuất kho → kế toán duyệt xuất một phần → trang Ghi thu thu đủ → chi tiết đơn hiện Đã xuất / Còn phải xuất, chứng từ liên quan, nhật ký; bộ lọc, chọn cột, chọn thời gian hoạt động. Ảnh ở thư mục `anh-v50`.
**Giới hạn**: chưa đọc ủy nhiệm chi tự động và chưa có hình thức Bù trừ ở trang Ghi thu; tiến độ phiếu kho chỉ có Chờ kho / Đã xuất (chưa tách soạn, kiểm, giao); chưa có module Hóa đơn điện tử riêng.

## Cập nhật v49 (20/11)
1. **Bán hàng (NV kinh doanh)**: lên đơn → duyệt theo quy trình "Đơn bán" (Cài đặt › Quy trình & phê duyệt: điều kiện cần duyệt, người duyệt; đơn không chạm điều kiện thì tự duyệt) → bấm **Yêu cầu xuất kho**. Hệ thống tạo phiếu xuất chờ duyệt (số còn lại của từng dòng) và báo người duyệt kho.
2. **Kho**: mở phiếu ở Kho › Phiếu kho › Xuất (hoặc Trung tâm phê duyệt), sửa số thực xuất nếu xuất một phần (không vượt số yêu cầu) → **Duyệt**: trừ tồn (dùng hàng giữ chỗ theo PO trước), đơn tự ghi "Đã xuất", trạng thái **Xuất một phần** hoặc **Hoàn thành** khi xuất đủ; báo người lên đơn. Phần chưa xuất: NV kinh doanh bấm Yêu cầu xuất kho tiếp.
3. **Trả hàng**: kho lập **phiếu nhập kho**, chọn **Đơn hàng trả lại** (nạp các dòng đã xuất), nhập số trả, chọn kho nhận → duyệt: cộng tồn, đơn ghi cột "Trả", giảm số phải thu (giá sau chiết khấu + VAT); báo người lên đơn (và kế toán nếu đơn đã thu tiền). Hủy phiếu đã duyệt thì đơn trừ lại số đã xuất / đã trả.
4. **Kế toán**: mở đơn ở Bán hàng → **Ghi thu** (tự sinh phiếu thu quỹ); tab "Chưa thu đủ" lọc đơn còn phải thu; báo khi khách trả thừa (sau trả hàng).
5. **Hóa đơn**: trong đơn có **Yêu cầu xuất hóa đơn** (số tiền, ghi chú) gửi kế toán; kế toán nhập số hóa đơn → "Đã xuất", hoặc trả lại có lý do; tab "Chờ xuất HĐ".
6. **Danh sách đơn bán**: bỏ hàng chỉ số; tab Tất cả / Chờ duyệt / Chờ xuất kho / Xuất một phần / Hoàn thành / Chưa thu đủ / Chờ xuất HĐ / Đã hủy; lọc thời gian (hôm nay … năm nay); bộ lọc gom vào nút phễu (thanh toán, NV bán, kho); mỗi trường 1 cột, 8 cột ẩn sẵn bật ở nút chọn cột; dòng tổng.
7. **Chi tiết đơn**: thanh bước Tạo đơn → Duyệt → Yêu cầu xuất kho → Kho xuất → Hoàn thành; bảng hàng có Đặt / Đã xuất / Chờ kho / Còn lại / Trả; khối "Phiếu kho của đơn"; khối Hóa đơn; khóa sửa khi đã xuất.
8. Nút **Yêu cầu xuất hóa đơn** và khối Hóa đơn luôn có trong đơn (sau khi đơn được duyệt), không phụ thuộc ô "Xuất hóa đơn VAT" lúc lên đơn.
9. Bảng dùng chung: nút chọn cột không còn đè lên tiêu đề cột cuối khi các cột cuối đang ẩn.

**Kiểm tra**: TypeScript không lỗi (kể cả strict); chạy thử trên trình duyệt: NV kinh doanh lên đơn 5 cuộn → yêu cầu xuất kho → kế toán (quyền duyệt kho) duyệt xuất 2 → đơn "Xuất một phần" → yêu cầu tiếp → duyệt 3 từ Trung tâm phê duyệt → "Hoàn thành"; yêu cầu xuất hóa đơn → kế toán ghi số HĐ; ghi thu; kho nhập trả 1 cuộn theo mã đơn → đơn ghi Trả 1, giảm phải thu 307.800. Chạy lại kiểm tra v48 (duyệt đơn giảm giá, đề nghị 3 bước, ủy quyền) không lỗi.
**Giới hạn**: đơn có vật tư xưởng / hàng gia công (MFG) vẫn xuất theo cách cũ; hủy phiếu xuất đã duyệt không trả lại hàng giữ chỗ theo PO (chỉ hoàn phần tồn tự do); "Hoàn thành" tính theo xuất đủ, chưa xét thu tiền / hóa đơn (theo dõi riêng); chưa kết nối nhà cung cấp hóa đơn điện tử (kế toán nhập số HĐ tay).


# 3A CRM v48 (Quy trình & phê duyệt, Đề nghị, bảng chọn nhiều, ảnh nổi / con dấu, nhập Excel — dựa trên v46)

> Không đổi bảng, SQL. Không thêm thư viện. Dữ liệu mới nằm trong dữ liệu doanh nghiệp: `wfDefs` (quy trình đã sửa / tự tạo), `wfRuns` (tiến trình duyệt nhiều bước, đề nghị), `wfPolicy`, `wfDelegations`. Dữ liệu cũ mở bình thường; yêu cầu đang chờ từ bản trước vẫn duyệt được.
> Máy chủ: sửa `src/app/api/ai/extract/route.ts` (nhận bảng Excel, gộp tên hàng xuống dòng) và `src/app/api/_lib/ai.ts` (giới hạn trả lời 8.192 token cho danh sách dài).

## Cập nhật v48 (19/11)

**Cài đặt › Quy trình & phê duyệt (mới)**
- 13 quy trình có sẵn (hiện theo loại doanh nghiệp): duyệt giá báo giá, hợp đồng, đơn bán (giảm giá / vượt hạn mức nợ), xác nhận tiền thu đơn bán, công tác / nghỉ, chi phí công tác, đề xuất quỹ MDF, thẩm định POP & đối soát hóa đơn, phiếu kho, nội dung marketing, báo giá xưởng lãi gộp thấp, bản vẽ triển khai, xác nhận tiền thu đơn hàng.
- Sửa từng quy trình: điều kiện cần duyệt (lãi gộp, giá trị, chiết khấu…), thêm / bớt / đổi thứ tự bước, người duyệt (trưởng phòng của khách / dự án, quản lý trực tiếp, vai trò, người cụ thể, thủ kho), bước có điều kiện, SLA, hạn mức bước, hạn mức cá nhân, quá hạn chuyển cấp trên, cho / không cho yêu cầu bổ sung; chạy thử với số liệu giả định; lưu thành phiên bản mới, nhật ký thay đổi.
- Quy tắc chung: không tự duyệt; Giám đốc duy nhất được tự duyệt (ghi nhật ký bảo mật); Giám đốc duyệt thay mọi bước; quá SLA thì trưởng phòng của người duyệt / Giám đốc cùng duyệt được; người duyệt nghỉ phép cả ngày thì tự chuyển người thay.
- Ủy quyền duyệt theo khoảng ngày (người duyệt thay, ghi "duyệt thay ai").
- Tạo quy trình mới: biểu mẫu tự thiết kế (chữ, số, số tiền, ngày, chọn, file / ảnh, người, khách hàng), 5 mẫu sẵn (mua tài sản, tạm ứng, thanh toán nhà cung cấp, văn phòng phẩm, tuyển dụng), ai được gửi, tiền tố mã, sau khi duyệt (báo người gửi, tự sinh phiếu chi, báo thêm một người).

**Công việc › Đề nghị (mới)**: chọn loại đề nghị, điền biểu mẫu, xem trước đường duyệt; theo dõi từng bước; rút lại; sửa và gửi lại khi bị trả; in phiếu đề nghị có người duyệt; người duyệt duyệt / từ chối / yêu cầu bổ sung ngay trong đề nghị. Đề nghị cũng hiện ở Trung tâm phê duyệt (nhóm "Đề nghị").

**Sửa lỗi luồng duyệt (theo kiểm tra v46)**
1. Báo giá khách không gắn dự án tới đúng Trưởng phòng của khách (trước chỉ Giám đốc thấy).
2. Báo giá Giám đốc tự lập không còn bị kẹt (Giám đốc duy nhất tự duyệt, có nhật ký).
3. Báo giá điều chỉnh: bản cũ rời hàng chờ.
4. Phiếu kho chờ duyệt vào Trung tâm phê duyệt, báo người duyệt khi lập phiếu; người lập không tự duyệt phiếu chờ của mình.
5. Lịch công tác đã duyệt mà đổi thời gian / chi phí thì phải duyệt lại.
6. Thông báo lọc theo người nhận (mã người dùng); Trưởng MKT không còn xem thông báo của người khác.
7. Không tự duyệt: đề xuất quỹ, POP, nội dung marketing, bản vẽ, hợp đồng (trừ Giám đốc duy nhất).
8. Duyệt hợp đồng / đề xuất quỹ từ danh sách đi qua quy trình; từ chối nhập lý do ở Công việc.
9. Hạn mức: tùy chọn "người duyệt phải đủ hạn mức cá nhân" và "hạn mức bước" cho mọi quy trình.
10. Đơn bán: người không có quyền duyệt phiếu kho bấm "Gửi yêu cầu xuất kho", Thủ kho / Kế toán duyệt; đơn giảm giá trên 10% hoặc vượt hạn mức nợ chờ Trưởng phòng duyệt mới xuất kho; tiền thu chờ xác nhận vào Trung tâm phê duyệt.
11. Báo giá xưởng (ALUX) lãi gộp dưới 25% phải duyệt mới in / nhận cọc.
12. Bản vẽ chờ duyệt vào Trung tâm phê duyệt, báo người duyệt.

**Bảng**: mọi bảng dùng chung có ô tích chọn nhiều dòng + thanh thao tác (sao chép, xuất CSV, in các dòng chọn, thao tác riêng như in phiếu / hủy đơn ở Bán hàng) và nút chọn cột hiển thị (nhớ theo trình duyệt; "Hiện tất cả", "Mặc định"). Danh sách đơn bán có thêm 4 cột ẩn sẵn: NV bán, Kho xuất, Hẹn giao, Hạn công nợ. Bảng đã có ô chọn riêng (lead, khách hàng, Trung tâm phê duyệt…) giữ cách chọn cũ.

**Báo giá / hợp đồng › Sửa trực tiếp**
- "Ảnh nổi": ảnh PNG kéo thả tự do, đặt trên hoặc dưới chữ, phóng to / thu nhỏ, phím mũi tên nhích (Shift: 10px), Delete để xóa; không làm xô lệch chữ.
- "Dấu & ký" (ảnh mộc ở Cài đặt › Doanh nghiệp) hoặc "Dấu / ký khác": báo giá đặt ở đầu trang đè lên góc logo; hợp đồng đặt đúng ô "Đại diện bên bán / Bên B", giữ khoảng trống ký; kéo chỉnh được. Ảnh mộc đã in sẵn trong ô ký được chuyển thành ảnh nổi (không bị trùng). Vị trí gắn theo ô nên bản in / PDF đúng chỗ.
- Khung sửa dùng đúng khổ A4 như bản in.

**Báo giá › Nhập từ ảnh / PDF / Excel**: nhận .xlsx và .csv (đọc trên trình duyệt; có phân tích thì CRM 3A phân tích bảng, chưa bật thì tự nhận cột Tên / ĐVT / SL / Đơn giá); .xls đời cũ nhắc lưu lại .xlsx. Tên hàng xuống nhiều dòng trong PDF / ảnh không còn bị tách thành nhiều dòng hàng (máy chủ và trình duyệt cùng nối dòng tiếp nối vào tên dòng trên); danh sách dài bị cắt giữa chừng vẫn giữ các dòng đã đọc trọn.

**Kiểm tra**: TypeScript không lỗi (kể cả strict); chạy thử trên trình duyệt với 6 tài khoản mẫu: đề nghị 3 bước (Trưởng phòng → Giám đốc → Kế toán, tự sinh phiếu chi); báo giá khách tới Trưởng phòng; bản cũ rời hàng chờ; Giám đốc tự duyệt báo giá của mình; đơn bán giảm giá chờ duyệt → yêu cầu xuất kho → Kế toán duyệt; phiếu kho mẫu duyệt trong Trung tâm; ủy quyền duyệt thay; chọn nhiều + chọn cột; con dấu ở báo giá / hợp đồng, so vị trí khi in; nhập Excel (có và không có phân tích).
**Chưa làm / giới hạn**: nhắc lại tự động theo giờ khi quá SLA (hiện là chuyển thêm người duyệt và đánh dấu quá hạn); bước "cần tất cả người trong nhóm cùng duyệt"; file Word xuất ra không giữ vị trí ảnh nổi (PDF / in giữ đúng); nhập Excel và gộp tên hàng mới thử với dữ liệu giả lập, cần thử lại với file thật trên bản có khóa phân tích.


# 3A CRM v46 (phân hệ Bán hàng, sắp xếp lại menu trái — dựa trên v45)

> Không đổi bảng, API hay SQL, không thêm thư viện. Đơn bán lưu trong dữ liệu doanh nghiệp như các phân hệ khác (khóa mới `salesOrders`); dữ liệu cũ mở bình thường.

## Cập nhật v46 (19/11)
**Menu trái** (phân phối): Tổng quan · Làm việc · **Bán hàng** (Bán hàng, Khách hàng, Dự án, Tài liệu) · **Marketing** (Lead, Auto Content, MDF/CS) · Hàng hóa · Tài chính (Thu chi, Công nợ) · Cài đặt.
Sản xuất (ALUX): Bán hàng (Bán hàng, Khách hàng, Đơn hàng, Tài liệu) · Marketing (Lead, Auto Content) · Xưởng · Tài chính · Cài đặt. Đường dẫn cũ (#/…/marketing, /claims, /docs) vẫn mở đúng trang.

**Bán hàng › danh sách đơn bán**: 4 số (doanh số hôm nay so với hôm qua, doanh số tháng, chờ xuất kho, ghi công nợ trong tháng), tab Tất cả / Chờ xuất kho / Đang giao / Hoàn thành / Đã hủy / Từ báo giá, tìm theo mã đơn, khách, SĐT, mã hàng, lọc hình thức thanh toán, xuất CSV.

**Lên đơn bán** (tại quầy): tìm hoặc quét mã hàng (Enter thêm dòng đầu), gợi ý hiện tồn khả dụng và giá đã bán cho khách này; khách CRM (hiện đang nợ / hạn mức / khoản quá hạn, tự áp bảng giá) hoặc khách lẻ (tên + SĐT); thanh toán Tiền mặt / Chuyển khoản / Trả một phần / Công nợ (hạn ngày); VAT từng dòng, chiết khấu, phí giao; Lấy tại cửa hàng / Giao hàng / Gửi xe; "Xuất kho ngay khi hoàn tất"; Lưu tạm; phím F9 = Hoàn tất.
Sản xuất: bán vật tư, phụ kiện (trừ tồn Vật tư, lập phiếu PX) và sản phẩm gia công trong bảng giá (đơn vị bộ / cái → tự tạo lệnh sản xuất, xuất giao khi xưởng làm xong).

**Chốt báo giá tự tạo đơn bán**: Chốt đơn dự án, Ghi nhận chốt báo giá nháp, và (mới) Ghi nhận chốt báo giá của khách có sẵn trong CRM → tạo đơn bán lấy nguyên giá, chiết khấu, VAT, hạn công nợ. Màn báo giá đã chốt có thẻ "Đơn bán tự tạo khi chốt": từng mã đủ hàng (đang giữ) hoặc thiếu, nút **Tạo phiếu đặt hàng** (lập PO theo nhà cung cấp cho phần thiếu, hàng về tự giữ chỗ cho khách / dự án) và **Giao trước phần có sẵn** (tách phần thiếu sang đơn giao sau).

**Chi tiết đơn**: Xuất kho (dùng hàng giữ chỗ cho khách / dự án trước, phần còn lại lập phiếu xuất kho XK đã duyệt, trừ tồn kho đã chọn), Đã giao xong, Hủy đơn (chỉ khi chưa xuất kho; đã xuất thì nhập trả ở Kho), In phiếu bán hàng, Thu tiền (người có quyền quỹ: tự sinh phiếu thu "Thu tiền bán hàng"; người khác: chờ Kế toán xác nhận), chứng từ liên quan.

**Giữ hàng**: đơn chưa xuất kho giữ mềm số lượng (chưa trừ tồn); đơn lên trước được ưu tiên hàng. **Công nợ**: đơn đã xuất kho chưa thu đủ vào Tài chính › Công nợ & tuổi nợ (hạn = ngày xuất kho + số ngày công nợ, chỉ tính tiền Kế toán đã xác nhận).

**Quyền**: thêm dòng "Bán hàng" trong ma trận phân quyền (mặc định bật cho mọi vai trò trừ Marketing). Lên đơn: quyền lập phiếu kho hoặc quản lý đơn hàng; Xuất kho: quyền xuất giao / quản lý kho / duyệt phiếu kho; Đặt hàng: quyền PO; xác nhận tiền: Kế toán.

**Kiểm tra**: TypeScript không lỗi (kể cả strict như Next build); chạy thử trên trình duyệt: lên đơn tại quầy trả tiền mặt (tự xuất kho XK, phiếu thu vào quỹ), chốt báo giá nháp thiếu hàng → tự tạo đơn, lập PO phần thiếu, tách giao trước, xuất kho; đơn công nợ khách CRM → vào bảng tuổi nợ; giao diện ALUX tìm vật tư đúng tồn; không lỗi console.
**Chưa làm**: giữ hàng chưa hiện ở màn Kho (chỉ hiện ở Bán hàng và báo giá); trả hàng sau khi xuất kho làm bằng phiếu nhập ở Kho; quét mã vạch dùng máy quét dạng bàn phím (gõ vào ô tìm), chưa dùng camera.

# 3A CRM v45 (sửa theo góp ý test báo giá — dựa trên v44)

> Cần cài thêm thư viện: `jspdf`, `html2canvas` (tạo PDF để chia sẻ / đính kèm), `nodemailer` (gửi email từ máy chủ). Script `cai-dat-v45.ps1` tự cài.
> Gửi email thật cần biến môi trường SMTP_* trên Vercel (xem env.local.example). Không đổi bảng / SQL.

## Cập nhật v45 (19/11)
1. **Báo giá nháp**: Sửa (lưu đè, giữ số), Xóa (có Hoàn tác), Báo giá điều chỉnh (phiên bản mới) — trong màn báo giá và menu "⋮" ở Tài liệu › Báo giá. Báo giá không gắn dự án cũng tạo được báo giá điều chỉnh; các phiên bản gom chung một dòng.
2. **Chia sẻ**: tạo file PDF rồi mở bảng chia sẻ của máy (Zalo, Messenger, Email…) trên điện thoại / Windows / macOS; trình duyệt không hỗ trợ thì tải PDF về.
3. **Tên pháp nhân**: không còn tự gập thẻ khi vừa gõ 1 ký tự.
4. **Thẻ Khách hàng** có nút Thu gọn / Mở.
5. **Bảng hàng**: bỏ cột Kho, GM; thêm cột **Ghi chú** (in lên báo giá), gợi ý tiến độ theo tồn kho (Có sẵn / Có sẵn x, còn lại ~N ngày / Đặt hàng ~N ngày), nút "Điền tiến độ hàng".
6. **Mặc định**: công nợ 0 ngày; bảo hành để trống = "theo tiêu chuẩn nhà sản xuất" (in đúng câu này trên báo giá / hợp đồng).
7. **VAT nhiều thuế suất**: chọn VAT "Theo từng dòng" → mỗi dòng chọn 0/5/8/10%; bảng in thêm cột VAT và tách dòng "Thuế GTGT 8% (trên …)", "Thuế GTGT 10% (trên …)"; tổng tiền, danh sách báo giá tính đúng theo từng thuế suất.
8. **Gửi khách**: Email gửi từ máy chủ email của doanh nghiệp kèm PDF (khi có SMTP_*), chưa cấu hình thì mở ứng dụng email và chỉ đường tới Cài đặt › Email. Zalo: nếu khách đã nhắn / quan tâm OA (tìm theo số điện thoại trong hội thoại Zalo của CRM) thì gửi thư + file PDF qua **Zalo OA**, lưu vào hội thoại; chưa có thì sao chép thư và mở Zalo cá nhân.
9. **Sửa trực tiếp** có thanh soạn thảo: hoàn tác / làm lại, đậm / nghiêng / gạch chân, tiêu đề, danh sách, căn trái / giữa / phải, chèn ảnh (đổi cỡ 25–100%, căn giữa, xóa, kéo thả để di chuyển), chèn bảng, thêm / xóa dòng, cột, xóa bảng.
10. **Gợi ý giá theo lịch sử**: gõ tên hàng → ưu tiên giá đã bán gần nhất cho chính khách này, sau đó giá bán gần nhất cho khách khác, cuối cùng là bảng giá (ghi rõ nguồn giá trong gợi ý).
11. **Từ ngữ**: các thao tác đọc tài liệu / soạn / rà soát ghi "CRM 3A đang phân tích…", "CRM 3A đang soạn…" thay cho tên AI.

**Chưa kiểm chứng với tài khoản thật**: gửi email qua SMTP và gửi file qua Zalo OA (upload file v2.0 + tin nhắn tư vấn v3.0) — mã đã viết theo tài liệu Zalo / nodemailer, cần thử trên bản Vercel với khóa thật. Zalo OA chỉ gửi được cho người đã nhắn / quan tâm OA trong thời hạn Zalo cho phép.
**Giới hạn trình soạn thảo**: chưa kéo giãn độ rộng cột bảng bằng chuột (đổi cỡ ảnh bằng nút %).

# 3A CRM v44 (Cài đặt, Báo giá, Hợp đồng bám 18 ảnh đề xuất — dựa trên v43)

> Không đổi bảng, API hay SQL. Các trường mới (báo giá nháp, nội dung sửa trực tiếp, phạt chậm thanh toán, giấy ủy quyền, chi nhánh) là trường tùy chọn trong dữ liệu đã có; dữ liệu cũ mở bình thường.

## Cập nhật v44 (19/11)

**Báo giá**
- Thẻ từng phần: Khách hàng dạng tóm tắt + "Đổi" (bảng giá, VAT ở cạnh), Hàng hóa có cột Kho và GM riêng, "Thường mua kèm" trong thẻ hàng, Điều khoản 4 ô một hàng với chọn mẫu ở đầu thẻ.
- Kiểm tra trước khi gửi có nút xử lý ngay: Gửi duyệt, Ghi chú giao (tự thêm câu giao hàng vào ghi chú), Nhập MST.
- Bước Gửi khách là màn riêng: kênh Email / Zalo / Tải về, thư soạn sẵn (AI: ngắn hơn, trang trọng hơn, soạn lại; dùng chữ ký của người gửi nếu có), đính kèm, chân màn hình "Quay lại / Gửi báo giá".
- **Báo giá nháp (khách lẻ)**: không MST, công nợ 0 ngày, chưa có trong CRM → lưu là xuất được ngay, không cần duyệt giá; Tài liệu › Báo giá có lọc "Nháp, khách lẻ"; nút "Ghi nhận chốt" tự thêm khách vào CRM (dùng khách trùng tên + điện thoại nếu đã có).

**Hợp đồng**
- Thẻ Căn cứ (tóm tắt báo giá + Đổi báo giá, hàng hóa gấp gọn), Bên mua 3 cột có **Giấy ủy quyền** (in cạnh chức vụ người ký), Thanh toán theo đợt có dòng Cộng, Bảo lãnh / **Phạt chậm thanh toán** (%/ngày, in dưới điều thanh toán) / Bảo hành.
- Chế độ **So sánh phiên bản** riêng: danh sách thay đổi, tóm tắt AI cho người duyệt, ô ý kiến + Duyệt / Từ chối (ghi lý do), **Khôi phục bản cũ** (tạo phiên bản mới từ nội dung bản cũ).
- Nút chính: "Trình ký" (điều khoản chuẩn) hoặc "Trình duyệt" (có điều khoản đặc biệt).

**Khung xem trước (báo giá và hợp đồng)**
- Thu nhỏ / phóng to, 100%, Vừa khung (nhớ lựa chọn), Toàn màn hình, In, **Chia sẻ** (điện thoại / máy hỗ trợ: gửi file Word qua Zalo, email; máy không hỗ trợ: tải file về). In và chia sẻ theo đúng khóa duyệt giá / hiệu lực.
- **Sửa trực tiếp** trên trang xem trước: bấm vào chữ để sửa, "Xong" lưu nội dung vào bản đang soạn (lưu cùng phiên bản, xuất PDF / Word đúng bản đã sửa); "Dựng lại từ form" để quay về bản dựng từ mẫu.
- Mục lục "Điều N" bên trái trang hợp đồng.

**Cài đặt**
- Tổng quan: thẻ Sức khỏe hệ thống. Doanh nghiệp: nút "Điền từ giấy phép ĐKKD", nhãn MST đúng / sai dạng, bảng Văn phòng / chi nhánh (biến {{company_branches}}).
- Phân quyền: ô tích 3 trạng thái (đủ / một phần / tắt), tab Nhật ký thay đổi.
- Phòng ban, Phân loại khách, Dữ liệu & bảo mật: tiêu đề ngoài thẻ, bỏ khung gấp; Phân loại khách có "Đề xuất xếp hạng" theo doanh số (Duyệt từng khách); Dữ liệu & bảo mật có tải nhật ký CSV và thẻ "Phát hiện bất thường" (đăng nhập lỗi dồn dập, khóa tài khoản, đổi quyền ngoài giờ).
- Kế toán: thẻ Công nợ, Số chứng từ (định dạng + số tiếp theo, chỉ xem), Số dư đầu kỳ, Phiếu tự sinh, AI soạn mẫu tin nhắc nợ (sao chép để gửi).
- Kho: bảng kho, Quy tắc phiếu kho đang áp dụng, Gợi ý mức tồn tối thiểu (Áp dụng tất cả).
- Quỹ Hãng: cột Đã dùng (đã duyệt chi + đang giữ chỗ) và Trạng thái; tiêu chí claim mở sẵn.
- Ngân sách Marketing: 4 số (kế hoạch, đã chi, chi phí mỗi lead, ROI theo đơn chốt từ kênh), cột % dùng và CPL, AI gợi ý phân bổ.
- AI & trợ lý: 3 thẻ trạng thái nhà cung cấp, Nhà cung cấp, Tính năng, An toàn dữ liệu, Thử kết nối (đo thời gian). Zalo: thẻ OA + webhook, Phân công hội thoại, Mẫu trả lời nhanh, Mẫu ZNS. Email: 2 cột, thanh "Có thay đổi chưa lưu". Getfly: dải 4 số trạng thái.

**Kiểm tra:** TypeScript không lỗi (kể cả chế độ strict như Next build); chụp lại 14 mục Cài đặt và 4 màn báo giá / hợp đồng ở 1440px, không lỗi console. Ảnh 3 cột trước (v43) / sau (v44) / đề xuất trong `anh-v44`.

**Không làm vì cần dịch vụ hoặc dữ liệu chưa có (không làm giả):** tra cứu MST trực tuyến, gửi email trực tiếp từ hệ thống và theo dõi khách đã mở thư, nhắc nợ / nhắc khách tự động theo lịch, thống kê lượt dùng và chi phí AI, đổi định dạng số chứng từ, lịch đồng bộ Getfly tự động, AI tự kiểm chứng chứng từ POP, xác thực 2 bước, công tắc cho các quy tắc kho (đang là quy tắc cố định của hệ thống nên hiện "Đang áp dụng").

# 3A CRM v43 (Phân quyền chỉnh lại theo đề xuất — dựa trên v42)

> v43 chỉ đổi giao diện trang Cài đặt › Phân quyền: **không đổi dữ liệu quyền, API hay SQL**.

## Cập nhật v43 (19/11): Phân quyền
- Ma trận: ô tích luôn cùng một cột (rãnh cố định ô tích 16px + số đếm 36px, dòng không có thao tác vẫn giữ rãnh trống); cột vai trò chia đều, cột Phân hệ cố định và đứng yên khi cuộn ngang trên điện thoại; mọi dòng cao 48px.
- Tiêu đề vai trò: tên, số tài khoản, phạm vi dữ liệu trên 3 dòng; vai trò đang chọn có vạch cam trên đầu và cả cột nền nhạt.
- Nhóm (Làm việc, Bán hàng…) không còn dải nền xám; bỏ khoảng trống thừa trước nhóm không tên.
- Số đếm 3 mức: bật đủ (đậm), bật một phần, 0 hoặc phân hệ tắt (nhạt). Ô khóa hiện ổ khóa thay cho ô tích xám. Ô tích vẽ riêng, giống nhau trên Windows / Mac, theo giao diện sáng / tối. Chú giải dùng đúng các ký hiệu.
- Chi tiết vai trò: Phạm vi dữ liệu dạng nút chọn tròn, mục đang chọn viền đậm; phân hệ và thao tác gộp một thẻ, mỗi dòng 3 cột (phân hệ | thao tác dạng ô tích 2 cột | công tắc), bỏ chữ "Truy cập" lặp lại; "Cho phép tất cả / Tắt tất cả" ở đầu mỗi nhóm.
- Bàn phím: ô tích là nút có vòng focus, đọc được bằng trình đọc màn hình.

# 3A CRM v42 (Cài đặt, Báo giá, Hợp đồng làm lại theo 18 ảnh đề xuất v42 — dựa trên v41)

> v42 **không đổi bảng, API hay SQL**. Không cần chạy file SQL mới. Trường mới "thanh toán theo đợt" là trường tùy chọn nằm trong dữ liệu hợp đồng đã có; hợp đồng cũ vẫn mở bình thường.

## Cập nhật v42 (19/11)

**Cài đặt**
- Mục mới **Tổng quan**: danh sách việc cần thiết lập tính từ dữ liệu thật (thông tin doanh nghiệp, logo và mộc, đại diện và ngân hàng, phòng ban và tài khoản, mật khẩu yếu, số dư đầu kỳ, kho, AI, Zalo, Email, Getfly), thanh tiến độ, nút đi tới từng mục.
- **AI & trợ lý** và **Zalo OA & ZNS** tách thành hai mục riêng, mỗi mục có tab con (AI: Trợ lý · Gợi ý khi gõ · Biến thể · Kiến thức · Bản tin & truyền thông; Zalo: Kết nối OA · Mẫu ZNS · Thông báo). Đường dẫn cũ `hub` / `zns` tự chuyển sang mục mới.
- **Doanh nghiệp**: bố cục 2 cột, xem trước đầu trang in (ô còn thiếu tô vàng), thanh "Có thay đổi chưa lưu"; **AI điền từ giấy phép kinh doanh / ảnh** (PDF cần Claude), chỉ liệt kê trường khác nhau để bấm "Dùng".
- **Phân quyền**: ma trận phân hệ × vai trò (tích để bật / tắt, số thao tác n/tổng bấm để xem chi tiết); **AI rà soát phân quyền** theo nguyên tắc quyền tối thiểu (chỉ gợi ý, không tự đổi).
- **Phòng ban & nhân sự**: dải số (phòng ban, tài khoản hoạt động, chưa đăng nhập 30 ngày, ghế bản quyền), cột "Đăng nhập" gần nhất.
- **Kế toán & công nợ**: thanh nhóm tuổi nợ đang dùng; thanh "Có thay đổi chưa lưu".
- **Kho hàng**: gợi ý mức tồn tối thiểu từ lượng xuất 90 ngày × thời gian về hàng, bấm "Áp dụng" (có ghi nhật ký).

**Báo giá**
- Thanh bước trên đầu (Khách hàng · Hàng hóa · Điều khoản · Gửi khách), bấm để cuộn tới phần tương ứng.
- Mỗi dòng hàng hiện **tồn kho** (đỏ khi thiếu, ghi số thiếu) cạnh mã hàng; lãi gộp từng dòng giữ như cũ.
- Chân màn hình: Tổng, Lãi gộp (chỉ người xem được giá vốn); màn rộng ≥1536px hiện thêm Cộng tiền hàng, VAT.
- **Kiểm tra trước khi gửi** (tính ngay, không cần AI): dòng có lãi gộp dưới ngưỡng, hàng thiếu tồn, MST trống / sai định dạng, thiếu email và điện thoại người nhận.
- **Thường mua kèm**: hàng hay đi cùng hàng đang báo trong các báo giá trước (từ 2 lần và ≥30%), bấm "Thêm".
- **Gửi khách** (sau khi báo giá được duyệt / không cần duyệt): thư soạn sẵn, **AI soạn / ngắn hơn / trang trọng hơn**, sao chép (dán vào Zalo, email), **Mở ứng dụng email** của máy (mailto) và Xuất PDF để đính kèm.

**Hợp đồng**
- Thanh bước (Căn cứ · Bên mua · Điều khoản · Trình ký), **mục lục "Điều N"** cạnh khung xem trước (màn ≥1280px), bấm để cuộn tới điều đó.
- Nút **Lấy lại từ CRM** điền pháp nhân bên mua từ hồ sơ khách / dự án.
- **Thanh toán theo đợt** (không bắt buộc): tên đợt, tỷ lệ, số tiền tự tính, điều kiện; tổng phải đúng 100%; bảng tự chèn dưới "Điều … Thanh toán" của mẫu (mẫu không có điều này thì thêm cuối văn bản).
- **AI rà soát hợp đồng**: đọc bản xem trước, nêu tối đa 6 điểm thiếu / mơ hồ / lệch số; chỉ gợi ý, không tự sửa, không thay luật sư.
- **So sánh phiên bản**: chọn 2 phiên bản, liệt kê thay đổi (giá trị, bên mua, điều khoản, hàng hóa, đợt thanh toán), **AI tóm tắt cho người duyệt**.
- Cột trái rộng hơn (54/46); link "Khai báo ở Cài đặt › Doanh nghiệp" mở đúng mục.

**Kiểm tra:** TypeScript không lỗi (cả chế độ strict như Next build); chụp lại 14 mục Cài đặt, Báo giá, Hợp đồng ở 1440px, không lỗi console. Ảnh trước / sau trong thư mục `anh-v42`.

**Chưa làm (cần thêm dữ liệu / dịch vụ, không tự bịa):**
- Gửi email trực tiếp từ hệ thống: chưa có máy chủ gửi thư thật, v42 mở ứng dụng email trên máy bạn (mailto, không tự đính kèm file). Gửi báo giá qua Zalo ZNS chưa làm (cần mẫu ZNS được duyệt có tham số báo giá).
- Tra cứu MST trực tuyến: chưa có API, chỉ kiểm tra định dạng.
- Thống kê lượt dùng / chi phí AI: cần ghi nhật ký ở máy chủ (thêm bảng SQL).
- Xác thực 2 lớp, đổi định dạng đánh số chứng từ, chi nhánh trên mẫu in.

# 3A CRM v41 (bố cục mới theo 75 ảnh đề xuất v40 — dựa trên v40)

> v41 chỉ đổi giao diện: **không đổi bảng, dữ liệu, API hay SQL**. Không cần chạy file SQL mới.

## Cập nhật v41 (19/11): đổi bố cục trang theo ảnh đề xuất

**Khung chung (mọi trang)**
- Đầu menu là tên doanh nghiệp, bấm vào để chuyển doanh nghiệp / Console (bỏ hàng "3A Group › VASSH"). Chân menu hiện người đang đăng nhập.
- Tiêu đề trang dùng tên ngắn như menu (Lead, Marketing, Kho, Công nợ, Quỹ MDF, Vật tư…). Bộ chọn thời gian hiện gọn "Tháng 11/2026", "Quý 4/2026", "Năm 2026".
- Nút tạo mới / thao tác chính nằm ở bên phải hàng tab (Thêm lead, Duyệt chọn, Thêm lịch, Lập phiếu, Tạo PO, Phiếu thu / chi, Đề xuất chương trình, Thêm đơn…).
- Thanh lọc một hàng: [ô tìm][lọc nhanh có số đếm][Bộ lọc][kiểu xem]; lọc nhanh trung tính (chấm màu + số).
- Bảng nằm sát mép thẻ, bỏ dòng tiêu đề kiểu "4 khách hàng"; dòng thấp hơn (≈44px); phân trang "1–4 trong 4 khách hàng".

**Từng trang**
- Bàn làm việc: Việc của tôi dạng danh sách; Sinh nhật sang cột phải.
- Tổng quan (4 tab): tiêu đề kỳ lớn "Tháng 11/2026" + dòng cập nhật; bộ chọn kỳ / so sánh / phòng / chỉ tiêu / PDF bên phải; phễu thanh mảnh.
- Công việc, Lịch công tác, Lead (Điều phối: dải 4 bước thay 4 thẻ số trùng; Data MKT), Khách hàng, Dự án (cảnh báo 1 dòng trên cùng), Sản phẩm (thanh lọc không khung), Kho (5 tab, Kiểm kho / Lập phiếu), Đặt hàng, Quỹ MDF (Claim & POP đứng đầu), Tài liệu.
- Thu chi: tab Sổ chi tiết / Tổng hợp trên cùng, chọn sổ dạng nút gộp có số dư, thanh lọc ngoài bảng.
- Công nợ: thẻ Tuổi nợ (thanh cơ cấu + chú giải) thay 4 ô; lọc nhanh theo nhóm nợ.
- Danh bạ: mặc định dạng bảng (họ tên, chức danh, phòng, điện thoại, email, ngày sinh, trạng thái), vẫn chuyển được sang thẻ.
- Tin nhắn / Zalo: màn rộng tự mở Kênh chung / hội thoại mới nhất (không còn màn chào trống).
- Marketing: tab tiếng Việt (Kế hoạch · Nội dung · Hình ảnh · Ngân sách · Tự động), thanh lịch gọn.
- Cài đặt: menu mục không khung, nhóm chữ thường, tên mục ngắn.
- ALUX: Đơn hàng, Sản xuất, Lắp đặt, Vật tư theo cùng bố cục (tab + nút trên cùng, thanh lọc ngoài bảng).
- 3A Console: bỏ băng tiêu đề và tab viên (menu trái đã có); Doanh nghiệp dạng bảng (mã, đường dẫn, gói, người dùng, hết hạn, module, dữ liệu, trạng thái, Truy cập).

**Kiểm tra:** TypeScript không lỗi; chụp lại 74 màn (VASSH, ALUX, Console, 12 mục Cài đặt) ở 1440px, không lỗi console. Ảnh trước / sau kèm theo.

**Chưa làm theo đề xuất:** nội dung form trong Cài đặt (thanh "Có thay đổi chưa lưu", công tắc), Cấp phép module / Người dùng của Console dạng bảng, Kế hoạch quỹ MDF dạng bảng hạng mục, giao diện điện thoại.

> v40 chỉ đổi giao diện: **không đổi bảng, dữ liệu, API hay SQL**. Không cần chạy file SQL mới (nếu chưa chạy `supabase-v39.sql` thì vẫn cần chạy file đó).

## Cập nhật v40 (18/11): giao diện mới theo đề xuất v40

**Khung ứng dụng**
- Menu trái nền xanh đậm, mở sẵn; **Tổng quan** nằm trên cùng, bỏ nút "+ Thêm nhanh". Tên mục rút gọn (Lead, Dự án, Kho, Đặt hàng, Quỹ MDF, Lịch công tác, Công nợ…) và xếp lại nhóm: Làm việc · Bán hàng · Hàng hóa (ALUX: Xưởng) · Tài chính · Tài liệu, Cài đặt.
- Chọn doanh nghiệp chuyển vào đầu menu. Thanh trên: tiêu đề trang, ô tìm khách hàng / MST / mã đơn, Chat và Trợ lý AI luôn ở thanh trên (bỏ cột biểu tượng bên phải).
- Có liên kết "Bỏ qua tới nội dung" cho bàn phím; nội dung rộng tối đa 1680px.

**Hệ thống giao diện chung** (sửa một chỗ, áp dụng mọi trang)
- Màu nền trung tính, một màu nhấn cam cho nút chính và mục đang chọn; nút phụ viền mảnh; trạng thái là chấm màu + chữ thay cho nhãn tô nền.
- Tiêu đề bảng chữ thường; số căn phải, cùng độ rộng chữ số; mã (SKU, mã KH, số phiếu, số HĐ) hiện dạng thẻ xám chữ đơn cách; SLA hiện "Còn 3 giờ" / "Quá 2 ngày" kèm đồng hồ, bỏ khung nhấp nháy.
- Chữ nhỏ nhất 11px, bỏ chữ IN HOA giãn chữ, bỏ chữ đậm 700–800; có viền focus cho bàn phím.
- Ô điện thoại `type="tel"`, ô email `type="email"` (bàn phím đúng trên điện thoại, trình duyệt tự điền).
- Bỏ hộp `window.confirm` khi đóng bài đang soạn ở Bàn làm việc, thay bằng xác nhận ngay trong khung.

**Bảng: mỗi thông tin một cột, mỗi dòng một bản ghi**
- Sản phẩm, Khách hàng, Dự án, Lead (Data MKT, Phân luồng), Công việc, Lịch công tác, Kho tài liệu, Kho (tồn kho, phiếu kho, xuất nhập tồn), Đặt hàng, Thu chi, Công nợ, ALUX (đơn hàng, sản xuất, lắp đặt, vật tư), Cài đặt (phòng ban, nhân sự, danh mục kho).
- Kho hàng: 8 tab gọn thành 5 (Tồn kho · Phiếu kho có chọn Nhập / Xuất / Chuyển / Kiểm · Thẻ kho · Xuất nhập tồn · Danh mục kho).
- Tổng quan: thẻ KPI thành một dải số; biểu đồ doanh thu tháng trước màu xám, tháng này màu cam, chỉ tiêu là đường mực.
- Khung cảnh báo lớn (chưa có chỉ tiêu, dự án quá hạn) đổi thành dòng chú thích có liên kết.

**Tài liệu › Báo giá & Hợp đồng** (làm lại cả hai)
- Nút chuyển Báo giá / Hợp đồng; nút chính đổi theo: "Tạo báo giá" / "Tạo hợp đồng".
- Báo giá: dải số (bộ báo giá, đã gửi chờ phản hồi, khách chấp nhận, hết hiệu lực trong 7 ngày); cột Mã (+ phiên bản), Khách hàng, Dự án, Ngày, Hiệu lực đến (đỏ khi hết hạn), Trước VAT, Sau VAT, Trạng thái. Menu dòng có **Tạo hợp đồng từ báo giá** và lịch sử phiên bản.
- Hợp đồng: dải số (hợp đồng hiệu lực, giá trị hiệu lực, chờ duyệt, bị từ chối cần sửa); cột Số hợp đồng (+ phiên bản), Bên mua, MST, Báo giá căn cứ, Ngày lập, Giá trị, Tạm ứng, Công nợ, Trạng thái. Rê chuột vào trạng thái xem lý do từ chối, điều khoản đặc biệt, bảo hành. Nút **Duyệt** ngay trên dòng chờ duyệt (người có quyền), Từ chối / xem / in / xuất Word, PDF / phiên bản cũ trong menu. Dòng bị từ chối có vạch đỏ; phiên bản cũ mở ngay dưới dòng, thẳng cột.

**Rà soát mã**
- Bỏ thư mục `single-file/` (bản sao 1 file 2,5 MB của chính `src/crm`, không được dùng khi build).
- Bỏ các hàm / component không còn ai gọi sau khi đổi giao diện (thẻ tóm tắt điều hành cũ, Sparkline, thanh "Thêm nhanh"…). Cấu trúc 86 file trong `src/crm` giữ nguyên như v39.
- Đã kiểm tra: TypeScript không lỗi; chạy thử trên trình duyệt ở 1440px các trang chính (Tổng quan, Bàn làm việc, Lead, Dự án, Sản phẩm, Khách hàng, Công việc, Quỹ MDF, Kho, Tài liệu › Hợp đồng, Cài đặt, Thu chi), không lỗi console.

**Còn lại / giới hạn**
- Ở màn 1440px, các bảng nhiều cột (Công việc, Lead, Dự án, Lịch công tác, Kế hoạch MDF, Sản phẩm, Phiếu kho, Đặt hàng, Kho tài liệu, Công nợ) vẫn cuộn ngang một đoạn; ở màn ~1920px vừa khung.
- Chưa làm lại trong đợt này: thẻ các bước Phân luồng lead, Kế hoạch quỹ MDF, lịch chiến dịch Marketing, bảng của 3A Platform Console, thanh lưu ở các form Cài đặt, danh sách dạng thẻ trên điện thoại, lưu tab / bộ lọc trên đường dẫn.
- Người dùng cũ: menu trái sẽ mở lại một lần (khóa ghi nhớ mới `pin40`).


> Luồng Plan → AI soạn → duyệt → Workspace đã chạy thử trên trình duyệt (riêng trình soạn TipTap thay bằng bản giả vì môi trường dựng không cài được thư viện). Đã kiểm tra kiểu TypeScript với khai báo TipTap v3
> và kiểm thử các hàm tính toán (chuyển dữ liệu, Human Score, so sánh, kiểm số liệu). Hãy thử trên máy / Vercel Preview trước khi gộp vào main.

## Cập nhật v39 (18/11): thêm doanh nghiệp A, B, C… không cần sửa code
**Cần làm 1 lần:** chạy `supabase-v39.sql` trong Supabase › SQL Editor (sau các file SQL trước). Chỉ thêm hàm `tenant_brand`, không đổi bảng / dữ liệu.

- **Danh mục doanh nghiệp không còn ghi cứng.** VASSH, ALUX có sẵn; doanh nghiệp mới tạo ở **3A Platform Console › Doanh nghiệp › Thêm doanh nghiệp**: tên, tên viết tắt, mã đường dẫn, tên miền email, loại hình (thương mại / sản xuất / cả hai), gói bản quyền, màu, logo, quản trị viên đầu tiên (email + mật khẩu tạm, bắt buộc đổi ở lần đăng nhập đầu). Hồ sơ lưu trong dữ liệu nền tảng, mọi máy tự cập nhật.
- **Doanh nghiệp mới bắt đầu sạch:** không mang dữ liệu mẫu của VASSH; phòng ban, nguồn lead, mẫu báo giá lấy theo loại hình; module cấp phép theo loại hình (chỉnh ở Cấp phép module). Dữ liệu tách biệt bằng RLS như VASSH / ALUX.
- **Đường dẫn riêng:** `crm.3agroup.vn/vassh`, `/alux`, `/<mã mới>` (thêm route `src/app/[org]/page.tsx`). Console hiện đường dẫn từng doanh nghiệp, có nút chép để gửi nhân viên. Vào app, đường dẫn tự đổi theo doanh nghiệp đang mở.
- **Trang đăng nhập mới** (theo mẫu): một thẻ Đăng nhập (email, mật khẩu, ghi nhớ), không còn ô chọn VASSH / ALUX nên không lộ danh sách khách hàng của nền tảng. Bên phải: logo + tên. Vào bằng đường dẫn riêng thì hiện logo, tên, màu của doanh nghiệp đó và giới thiệu theo loại hình; đường dẫn chung hiện nhận diện 3A Group.
- **Sau khi đăng nhập:** đúng đường dẫn và có quyền → vào thẳng; tài khoản thuộc 1 doanh nghiệp → vào thẳng; thuộc nhiều doanh nghiệp → màn **Chọn doanh nghiệp** (chỉ các doanh nghiệp được cấp quyền); quản trị 3A → chọn 3A Platform Console hoặc một doanh nghiệp. Vào nhầm đường dẫn doanh nghiệp không có quyền → báo rõ và cho chọn doanh nghiệp của mình.
- Chế độ lưu trên máy (không Supabase): đăng nhập nhận doanh nghiệp theo đường dẫn hoặc theo tên miền email.

## Cập nhật v38.10.1 (18/11): sửa lỗi build trên Vercel
- `src/crm/modules/home/home.tsx`: `useRef()` thiếu giá trị khởi tạo (React 19 bắt buộc), gây lỗi TS2554 khi `npm run build`. Đã sửa; bộ kiểm tra kiểu nội bộ cũng siết lại để bắt lỗi này.

## Cập nhật v38.10 (18/11): bỏ hàng ô chỉ số đầu trang
- Bỏ hàng KPI phía trên ở: Khách hàng (cả chế độ Nhà máy), Dự án & BOQ, Lịch công tác, Tài liệu (Kho tài liệu và Báo giá & Hợp đồng), Marketing Hub › Plan. Trang mở ra là thấy ngay bộ lọc và danh sách.
- Marketing Hub › Budget vẫn giữ 4 ô ngân sách / đã chi / lead / ROI vì đó là nội dung chính của tab. Số liệu tổng hợp vẫn xem ở Tổng quan và Báo cáo.

## Cập nhật v38.9 (18/11): tối giản Công việc và thanh trên cùng
- Công việc: bỏ hàng 4 ô chỉ số; tab Chờ tôi duyệt / Tôi đã yêu cầu / Lịch sử nằm ngay trên cùng. Cột "Nội dung" chỉ 1 dòng (lý do / mô tả hiện khi rê chuột, bấm để xem chi tiết). Số việc quá hạn vẫn thấy qua nhãn SLA đỏ và "Khẩn cấp" từng dòng.
- Thanh trên cùng: chỉ còn ảnh đại diện; tên, email, vai trò, doanh nghiệp hiện trong menu khi bấm vào ảnh (Tài khoản của tôi, Cài đặt, Đổi mật khẩu, Giao diện tối, Xem với vai trò, Đăng xuất như cũ).
- Bàn làm việc: bỏ thẻ Bản tin điều hành.

## Cập nhật v38.8 (18/11): Bàn làm việc tối giản, bảng tin kiểu Facebook
- Bố cục 3 cột: trái = mục bảng tin + Sinh nhật (+ hashtag); giữa = soạn bài + bảng tin (rộng tối đa 680px như Facebook); phải = Việc của tôi, Truyền thông (bỏ thẻ Bản tin điều hành khỏi Bàn làm việc). Bỏ thẻ hồ sơ và "Bán hàng xuất sắc" khỏi trang này. Ô "Hỏi trợ lý hoặc tìm nhanh" chuyển lên thanh trên cùng (⌘K vẫn mở tìm nhanh). Màu theo giao diện sáng / tối của app.
- Khung "Tạo bài viết": ảnh/video (nhiều ảnh, kéo thả, dán ảnh từ bộ nhớ tạm; ảnh tự nén ≤ 1600px), gắn thẻ đồng nghiệp (được báo), cảm xúc / hoạt động, địa điểm, bình chọn, đính kèm tài liệu; loại bài (Chia sẻ / Sáng kiến / Thông báo / Bình chọn). Các bước chọn đổi trang trong cùng khung, không mở thêm cửa sổ.
- Bài đăng: dòng đầu "… đang 😎 cảm thấy tuyệt cùng A và B tại Bắc Ninh.", thời gian kiểu Facebook, ảnh dạng lưới (1 / 2 / 3 / 4 / 5+ ảnh, ô cuối "+N"), bấm ảnh xem toàn màn hình (← → để chuyển, tải về), "Xem thêm" cho bài dài, chữ to cho bài ngắn.
- Thanh tương tác: Thích + 6 cảm xúc (rê chuột vào nút Thích), Bình luận, Chia sẻ (có số lượt), Lượt xem 👁 (tính khi bài hiện trên màn hình 1 giây, mỗi người 1 lần).
- Chia sẻ: chia sẻ ngay lên Bảng tin, chia sẻ kèm cảm nghĩ (bài gốc lồng bên trong **kèm ảnh**), chia sẻ ra Zalo / Facebook kèm ảnh (điện thoại mở bảng chia sẻ của máy; máy tính chép nội dung và tải ảnh về để dán), sao chép nội dung.
- Dữ liệu: bài cũ hiển thị bình thường; chỉ thêm các trường tùy chọn vào bài viết, không cần chạy SQL.

## Cập nhật v38.7 (18/11): nút thao tác ở Plan / Content / Budget; mẫu báo giá thiết bị vật tư
- **Content**: cột thao tác mỗi bài: Mở / sửa, Xem & duyệt, Nhân bản (bản nháp mới), Tải Word (.doc), Tải PDF (in / lưu PDF), Tải HTML, Sao chép nội dung, Xóa (hỏi xác nhận, hoàn tác được; bài AI đang soạn không xóa được). Thêm ô tìm kiếm và Xuất Excel danh sách.
- **Plan**: Xuất Excel có ở mọi chế độ xem; dạng Danh sách có menu: Sửa, Giao cho AI, Xem & duyệt, Mở Workspace, Nhân bản, xuất bài (Word / PDF / HTML / sao chép), Xóa. Xóa nhiệm vụ không xóa bài AI đã soạn.
- **Budget**: menu chiến dịch Sửa / Nhân bản (đã chi về 0) / Xóa; Xuất Excel bảng hiệu quả chiến dịch.
- **Mẫu báo giá**: biến mới `{{items_table_full}}` (STT, mã hàng, hạng mục, hãng SX lấy từ danh mục sản phẩm, đơn vị, số lượng, đơn giá, VAT từng dòng, thành tiền, ghi chú; dòng tổng nền vàng), `{{doc_date_long}}` (ngày 29 tháng 07 năm 2026), `{{doc_revision}}` (lần thứ), `{{sales_email}}`.
- File `mau/mau-bao-gia-vassh.html`: mẫu báo giá dựng theo file Excel "Mẫu báo giá 2026 VASSH", dán vào Tài liệu › Mẫu văn bản › Thêm mẫu mới.

## Cập nhật v38.6 (18/11): Marketing Hub = Plan · Content · Image · Budget · Automation
- **Tab mới, theo thứ tự**: Plan (trước là Lịch tổng), Content (Content Studio giữ nguyên), Image (mới), Budget (Ngân sách & ROI), Automation. Tab cũ đang ghi nhớ trên máy tự chuyển: Thiết kế banner → Image, Phân khúc → Automation.
- **Phân khúc được giữ** (không xóa) vì đang dùng thật: là điều kiện kích hoạt "Toàn bộ phân khúc" của kịch bản tự động và là "Phân khúc mục tiêu" của chiến dịch. Đã chuyển vào Automation › Phân khúc khách hàng.
- **Nhiệm vụ nội dung (Plan)** chia 3 tab: Thông tin chung · Cấu hình nội dung · Cấu hình hình ảnh; nút Lưu / Giao cho AI luôn nằm ở chân khung; tab còn thiếu thông tin có chấm đỏ.
  - **Mẫu nhanh** ở đầu tab nội dung (Bài PR kỹ thuật chuẩn SEO, Hướng dẫn thi công, So sánh / tư vấn chọn mua, Case study, Khuyến mãi Fanpage, Kể chuyện công trình, Mẹo kỹ thuật nhanh, Bản tin / Ưu đãi Zalo OA, Bài Google Maps) + mẫu riêng của doanh nghiệp: bấm 1 lần điền toàn bộ thông số. Nút ✦ cạnh "Mẫu nhanh": AI gợi ý 3 cấu hình theo tiêu đề.
  - Nhóm 2–3 lựa chọn dùng thanh chọn liền khối (VD Độ dài); nhóm nhiều lựa chọn dùng ô xổ xuống có tìm kiếm, chọn nhiều hiện thành thẻ trong ô (Chứng cứ, Bối cảnh…). Bỏ dấu sao cam; lựa chọn mặc định ghi chữ nhỏ "mặc định".
  - "+ Hiện cài đặt nâng cao": Số mục H2, Cấu trúc thêm, Mức độ kỹ thuật, Xưng hô, Mật độ / vị trí từ khóa, thông tin brief, Ghi chú thêm cho AI.
  - Nút AI ✦ trong góc ô Focus Keyword (hoặc Từ khóa địa phương / Lời kêu gọi) và ở tiêu đề khối Thông số kênh: AI điền các ô còn trống.
- **Chiến dịch** chia 3 tab: Thông tin chung · Mục tiêu & ngân sách (thanh đã chi, chi phí / lead mục tiêu) · Nội dung AI (chọn kênh AI soạn bài đầu tiên + đầy đủ thông số kênh, mẫu nhanh, cấu hình ảnh như Nhiệm vụ). Kênh chọn nhiều bằng ô xổ xuống.
- **Image**: Tạo ảnh AI · Thư viện ảnh · Thiết kế banner.
  - Tải tối đa 3 ảnh tham chiếu hoặc chọn ảnh sản phẩm trong danh mục, thanh "bám ảnh gốc ↔ sáng tạo".
  - 10 kích thước có sẵn (Bài Facebook 1200×630, Vuông 1080, Dọc 4:5, Story 9:16, Bìa Zalo OA, Ảnh bài website, Banner website 1920×600, Ảnh sản phẩm, Google Maps) hoặc tự nhập; ảnh xuất được cắt đúng kích thước.
  - Bối cảnh / phong cách / màu sắc, 1–3 phương án; ✦ AI viết mô tả ảnh.
  - SEO ảnh: từ khóa, tên file không dấu, alt ≤ 125 ký tự, chú thích, title (✦ AI viết cả 4), đóng logo / tên / không, WebP hoặc JPEG, chất lượng nén; ảnh xuất xóa EXIF / GPS của ảnh gốc, cảnh báo khi > 300 KB.
  - Lưu vào **Thư viện ảnh** (tối đa 200 ảnh / doanh nghiệp, nhóm dữ liệu mới `mktImages`); trong Workspace, khung chèn ảnh có "Chọn từ thư viện ảnh".
- **Automation**: thêm kênh Messenger (Fanpage). SMS và Messenger vẫn ghi nhận ở chế độ mô phỏng cho đến khi kết nối nhà cung cấp; ZNS / Zalo OA gửi thật như trước.
- Dữ liệu: DATA_VERSION 30 (chỉ thêm nhóm `mktImages`, không đổi dữ liệu cũ). Không cần chạy thêm SQL.

## Cập nhật v38.5 (18/11): sửa lỗi "AI trả sai định dạng"
- Nguyên nhân: "AI điền ô trống" chỉ cho AI tối đa 700 token; câu trả lời tiếng Việt dài (8 từ khóa LSI, meta description…) bị cắt giữa chừng, thường nằm trong khối ```json chưa đóng, nên bộ đọc JSON cũ không đọc được.
- Bộ đọc JSON mới (dùng cho mọi tính năng AI trả JSON): chịu được khối ```json, chữ giải thích trước / sau, ngoặc kép cong, dấu phẩy thừa, và câu trả lời bị cắt (giữ các ô đã trọn vẹn).
- AI điền ô trống: tăng lên 1.600 token, sai định dạng thì tự hỏi lại 1 lần; vẫn sai thì ghi câu trả lời gốc ra F12 › Console. AI gợi ý biến thể: 1.800 token; AI viết alt / chú thích ảnh: 600 token.

## Cập nhật v38.4 (18/11): luồng duyệt không phải qua 3 bước — đã chạy thử trên trình duyệt
- **Khung "Xem & duyệt"**: bấm bài ở Trung tâm phê duyệt (nhóm Nội dung marketing) hoặc "Xem & duyệt" trong Nhiệm vụ nội dung là mở ngay bài như sẽ đăng (bản xuất bản theo kênh, xem trước trên Google), điểm SEO, điểm tự nhiên, từ khóa, thông số còn thiếu, các tiêu chí SEO chưa đạt; nút Duyệt / Trả về sửa (bắt buộc lý do) / Mở để sửa. Không cần đi qua Cài đặt → Dàn ý.
- **Bài đã có nội dung (đã soạn, chờ duyệt, đã duyệt, bị trả về) mở thẳng Workspace**, ẩn thanh 3 bước; cần thì bấm "Sửa cài đặt / dàn ý". Ở Cài đặt / Dàn ý có nút "Về Workspace", không bị chặn khi thiếu Focus Keyword. Bài nháp mới vẫn đi 3 bước.
- Bài cũ chỉ có nội dung dạng chữ (không có khối) được tách theo tiêu đề ##/### để mở được trong Workspace.
- "Mở Workspace" từ Lịch tổng chuyển đúng sang Content Studio và mở bài, kể cả khi đang đứng ở Marketing Hub.
- Lịch tổng có trạng thái **Đã duyệt** (trước đây bài đã duyệt vẫn hiện "AI xong / chờ duyệt").
- "Giao AI làm lại" đưa bài về Nháp; bài AI đang viết dở không hiện trong danh sách chờ duyệt.
- Luật SEO "Độ dài" của Website theo nhóm Độ dài đã chọn (VD chọn Ngắn 600–800 từ thì chấm theo mức đó).
- Sửa lỗi form Nhiệm vụ nội dung bị tràn ngang khi mở phần biến thể.

## Cập nhật v38.3 (18/11): luồng duyệt nội dung
- **Trung tâm phê duyệt (Công việc)** có nhóm mới "Nội dung marketing": mọi bài Chờ duyệt (gửi tay hoặc AI soạn xong từ Lịch tổng) hiện ở đây cho Giám đốc / Trưởng Marketing, có đếm SLA 24 giờ, nút Duyệt / Từ chối / Yêu cầu sửa (bắt buộc ghi lý do) và "Xem" mở bài trong Content Studio. Người gửi thấy trạng thái ở tab "Của tôi".
- **Content Studio**: nút Gửi duyệt / Duyệt / Trả về sửa / Đánh dấu đã đăng nằm ngay đầu trang cạnh nhãn trạng thái (trước đây ở cuối trang, bị khuất dưới Workspace). Bài bị trả về hiện dải "Cần sửa trước khi gửi duyệt lại" kèm lý do.
- Gửi duyệt hoặc AI soạn xong: chuông thông báo của Giám đốc và Trưởng Marketing; duyệt / trả về: báo lại người gửi. Mỗi quyết định ghi vào nhật ký duyệt và chụp mốc "Đã duyệt" trong Lịch sử phiên bản.

## Cập nhật v38.2 (18/11): biến thể nội dung & hình ảnh, mẫu brief, AI gợi ý, cảnh báo trùng từ khóa
- **Yêu cầu nội dung bấm chọn** (form Nhiệm vụ nội dung ở Lịch tổng và Bước 1 Content Studio): Dạng bài · Độ dài (theo kênh: Website 600–800 / 1.200–1.500 / 1.800–2.500 từ; Facebook ≤ 80 / 120–200 / 300–500 từ; Zalo ≤ 150 / 150–300 từ; Maps ≤ 750 / ≤ 1.500 ký tự) · Giọng văn · Đối tượng đọc · Chứng cứ cần có · Số mục H2 · Cấu trúc thêm (FAQ, bảng, gạch đầu dòng, tóm tắt) · Mức độ kỹ thuật · Kết bài / CTA · Xưng hô · Mật độ và vị trí từ khóa (Website). Ô ★ là mặc định.
- **Mẫu brief theo dạng bài**: chọn Hướng dẫn, So sánh, Case study, Giới thiệu sản phẩm, Sai lầm thường gặp, Tin tức, Khuyến mãi là tự tích sẵn các nhóm phù hợp (VD Case study: ví dụ công trình, trước / sau, ý kiến khách, CTA khảo sát, ảnh tại công trình).
- **Yêu cầu hình ảnh bấm chọn**: số lượng ảnh, khung hình, bối cảnh, phong cách, màu sắc, đóng dấu (logo / tên / không), ảnh tham chiếu lấy từ danh mục Sản phẩm (AI bám theo hình sản phẩm thật).
- **✦ AI gợi ý**: AI đề xuất 3 tổ hợp phù hợp với tiêu đề, bấm là áp dụng. **Bộ cài sẵn**: lưu tổ hợp đang chọn thành bộ có tên, lần sau chọn 1 lần.
- "Xem chỉ dẫn gửi AI" hiện đúng đoạn yêu cầu được ghép từ các ô đã chọn. Ô ghi chú tự do vẫn giữ.
- **Cài đặt › AI, Zalo › Biến thể nội dung & hình ảnh**: ẩn / hiện lựa chọn, đặt mặc định riêng (☆), thêm lựa chọn riêng của doanh nghiệp (VD "Bảo hành 10 năm 3M"), xóa bộ cài sẵn. VASSH và ALUX cấu hình riêng.
- **Cảnh báo trùng từ khóa chính** với bài / nhiệm vụ khác ở form Nhiệm vụ và Bước 1 Studio, kèm danh sách bài trùng.
- Website: ô Đối tượng đọc, Độ dài, FAQ chuyển vào nhóm biến thể (dùng chung mọi kênh). Không đổi dữ liệu, không cần chạy SQL.

## Cập nhật v38.1 (18/11)
- **Bài AI soạn xong mở thẳng Workspace**, không bắt làm lại bước Cài đặt. Thiếu thông số kênh (VD Focus Keyword) thì hiện dải nhắc "Mở Cài đặt", nội dung vẫn sửa được.
- **Nhiệm vụ nội dung (Lịch tổng) có đủ thông số của kênh** như Bước 1 Content Studio: Website có Focus Keyword, LSI, Meta Title, Meta Description, slug, đối tượng đọc, ý định tìm kiếm, độ dài bài, liên kết nội bộ, FAQ; Facebook / Zalo có hook, giọng, CTA, hashtag; Maps có loại bài, từ khóa địa phương, NAP. Thêm "Brief nội dung": thông điệp chính, sản phẩm / mã hàng, ưu đãi, ý bắt buộc, điều không nhắc, nguồn tham khảo.
- Nút **"AI điền ô trống"** đề xuất từ khóa, LSI, meta, slug, ý định tìm kiếm từ tiêu đề (chỉ điền ô trống). Thiếu trường bắt buộc thì chưa giao AI được.
- AI chạy nền soạn theo đúng prompt của kênh + brief (như Content Studio), tự điền meta còn trống, ảnh có alt. Giao AI làm lại sẽ soạn mới theo thông số mới.
- Sửa lỗi kênh Google Maps không nhận đúng cài đặt khi mở lại bài.

## Cài đặt / nâng cấp từ v37
```bash
git checkout -b v38
npm i @tiptap/react@^3 @tiptap/core@^3 @tiptap/pm@^3 @tiptap/starter-kit@^3 @tiptap/extension-image@^3
# chép đè thư mục src/ của gói vào dự án, rồi XÓA thư mục cũ src/lib/ai/skills/sales_pipeline/ (đã gộp vào sales_crm)
npm run build
```
- Supabase SQL Editor: chạy `supabase-v38.sql` (sau v37; chạy lại nhiều lần vẫn an toàn). Tạo bảng đếm lượt `ai_usage`, hàm `ai_ghost_status` / `ai_ghost_take`, và chỉ cho Giám đốc / quản trị ghi cấu hình hạn mức (`'$'/aiQuota`).
- Biến môi trường mới (tùy chọn): `AI_COMPLETE_MODEL_ANTHROPIC` (mặc định claude-haiku-5-5), `AI_COMPLETE_MODEL_OPENAI` (mặc định gpt-4o-mini), `AI_GHOST_RATE_PER_MIN` (mặc định 12 lượt / phút / người), `AI_GHOST_DAILY_LIMIT` (chỉ dùng khi chạy cục bộ không Supabase).
- Dữ liệu: DATA_VERSION 29 chỉ thêm `contentVersions` (lịch sử phiên bản) và `aiQuota`. Bài cũ (dạng `blocks`) tự chuyển sang `doc` khi mở lần đầu; vẫn ghi `blocks` song song nên bản v37 đọc được. Không xóa dữ liệu, không đổi API cũ.

## Điểm mới v38

### Marketing Hub
- Tab "Lịch chiến dịch" đổi tên thành **Lịch tổng** (một lịch duy nhất cho chiến dịch và nội dung; đợt 3 nâng cấp kéo thả đa kênh).
- Content Studio còn 3 bước: Cài đặt → Dàn ý → **Workspace** (gộp "Viết & ảnh" và "Hoàn thiện").

### Workspace soạn thảo (TipTap)
- Một trang: dàn ý (trái, bấm để nhảy tới mục, "✦ Viết" cho mục trống, "AI viết n mục trống") · trình soạn (giữa) · sidebar dính 4 tab SEO · Tự nhiên · LSI · Lịch sử (phải).
- Bôi đen → thanh công cụ nổi: Đậm, Nghiêng, Liên kết (Ctrl+K), H2, H3, ✦ Viết lại (ngắn hơn / rõ hơn / thuyết phục hơn), ✦ Humanize, ✦ Chèn LSI.
- Gõ `/` ở dòng trống để chèn: H2, H3, đoạn, danh sách, danh sách số, trích dẫn, ảnh chuẩn SEO, lời kêu gọi liên hệ, đường kẻ.
- Mọi lệnh AI ra **đề xuất dạng so sánh** (chữ xóa gạch đỏ, chữ thêm xanh), Nhận / Bỏ; cảnh báo đỏ khi bản mới làm mất số liệu, mã sản phẩm hoặc từ khóa. Trình soạn khóa trong lúc chờ đề xuất.
- Ghost text: ngừng gõ ~0,6 giây ở cuối đoạn → AI gợi ý tối đa ~30 từ chữ mờ, Tab nhận, Esc bỏ, gõ tiếp thì hủy. Mặc định bật cho Giám đốc, Trưởng Marketing, nhân sự phòng Marketing; giới hạn 50 lượt / người / ngày (chọn 50, 100 hoặc số khác ở Cài đặt › AI, Zalo › "Gợi ý viết tiếp"). Máy chủ đếm và chặn khi vượt. Mỗi người tự tắt được ở cột dàn ý.
- Zen Mode: chỉ còn trang viết (~720 px), Esc thoát, có nút toàn màn hình.
- Xem bản xuất bản theo kênh ngay trong Workspace (nút "Bản Website / Facebook…"), sao chép HTML / bài.

### Tự nhiên (Human Score) & Humanize
- Điểm 0–100 tính trong trình duyệt, không tốn tiền AI: câu dài ngắn xen kẽ, đa dạng từ vựng, lặp cụm 3 từ, mật độ cụm sáo (sửa danh sách ở Cài đặt), độ đều của đoạn văn. Đoạn dưới ngưỡng được tô viền cam, liệt kê kèm lý do và nút "Humanize đoạn này".
- Humanize chọn giọng Giao tiếp / Chuyên gia / Bán hàng; giữ số liệu, mã, từ khóa. Đây là công cụ biên tập, **không phải máy dò AI** và không đảm bảo qua công cụ phát hiện nào.

### LSI, lịch sử, ảnh SEO
- Tab LSI: số lần từng từ khóa xuất hiện (không dấu), bấm từ còn thiếu → tô 1–3 đoạn hợp nhất, "Chèn vào đoạn này".
- Tab Lịch sử: tự lưu mốc khi AI viết, khi Humanize, khi Gửi duyệt / Duyệt, hoặc bấm "Lưu mốc"; tối đa 20 mốc / bài; chọn 2 mốc để so sánh theo từng khối (kèm điểm SEO, Human Score); khôi phục mốc (tự lưu mốc hiện tại trước).
- Ảnh chuẩn SEO: tải lên hoặc AI tạo; tên file theo tiêu đề mục (`bang-keo-vhb-mat-dung-kinh-1.webp`), alt ≤ 125 ký tự và chú thích do AI viết (sửa được), đóng logo doanh nghiệp, chuyển WebP. Tab SEO có danh sách ảnh để sửa alt / chú thích và luật mới: thiếu alt, alt trùng, alt ảnh đầu thiếu từ khóa. HTML xuất bản Website có `<figure>`, `alt`, `<figcaption>`.

### AI Copilot: 15 công cụ
- `src/lib/ai/tools/schema.ts`: định nghĩa tham số của 15 công cụ. Chạy được: `get_customer_360`, `get_sales_pipeline`, `check_mdf_budget`, `get_revenue_report`, `search_internal_documents`, `add_calendar_event` (ghi, cần xác nhận). Còn lại là khung (`draft: true`, AI không thấy) có chú thích bảng cần đọc.
- Mọi truy vấn dùng client gắn phiên đăng nhập người dùng (RLS tách doanh nghiệp); phạm vi Giám đốc / Trưởng phòng / nhân viên được lọc trong từng công cụ.
- Khung chat của app chưa có nút "Xác nhận" cho công cụ ghi dữ liệu: AI sẽ hỏi lại, việc thêm lịch qua Copilot cần bổ sung nút này ở bản sau.

## Ghi chú v37 (Tổng quan điều hành + chỉ tiêu KPI, AI Content Studio đa kênh, Copilot dạng Skill — dựa trên v36)

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
