import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'vi' | 'en' | 'zh' | 'ja' | 'ko';

const vi = {
  'welcome.title': 'CHÀO MỪNG QUÝ KHÁCH ĐẾN',
  'welcome.subtitle': 'XÁC THỰC TRƯỚC KHI QUA CỔNG',
  'welcome.description': 'Hoàn thành 3 bước để nhận thẻ định danh điện tử và qua cổng soát vé tự động.',
  'welcome.step1': 'Quét mã QR trên vé tàu của bạn',
  'welcome.step2': 'Chụp khuôn mặt',
  'welcome.step3': 'Chụp giấy tờ tùy thân',
  'welcome.start': 'Bắt đầu định danh',

  'language.title': 'Chọn ngôn ngữ',
  'language.done': 'Đóng',

  'qr.title': 'Quét mã QR vé tàu',
  'qr.subtitle': 'Bước tiếp theo: Quét khuôn mặt',
  'qr.hint': 'Đưa mã QR vào khung hệ thống sẽ tự động nhận diện',
  'qr.registering': 'Đang xử lý thông tin vé...',
  'qr.summaryTitle': 'Thông tin vé',
  'qr.passenger': 'Hành khách',
  'qr.idNumber': 'CCCD/Passport',
  'qr.seat': 'Số ghế/Tàu',
  'qr.departureTime': 'Thời gian khởi hành',
  'qr.route': 'Tuyến',
  'qr.nextStep': 'Bước tiếp theo',
  'qr.rescanHint': 'Quét lại nếu sai thông tin',
  'qr.errorInvalid': 'QR không hợp lệ',
  'qr.rescan': 'Quét lại',
  'qr.home': 'Trang chủ',
  'qr.resumeTitle': 'Tiếp tục định danh?',
  'qr.resumeMessage': 'Bạn đã hoàn thành xong bước Chụp khuôn mặt. Bạn muốn thực hiện lại bước này hay tiếp tục đến bước Chụp giấy tờ?',
  'qr.resumeRedo': 'Làm lại',
  'qr.resumeContinue': 'Tiếp tục',

  'face.title': 'Chụp khuôn mặt',
  'face.subtitle': 'Xác minh danh tính',
  'face.noSunglasses': 'KHÔNG kính râm',
  'face.noMask': 'KHÔNG khẩu trang',
  'face.noHat': 'KHÔNG đội nón',
  'face.verifying': 'Đang kiểm tra khuôn mặt...',
  'face.errorUnclear': 'Khuôn mặt không rõ',
  'face.errorMismatch': 'Khuôn mặt không khớp',
  'face.errorRemoveHat': 'Vui lòng tháo mũ xuống',
  'face.errorRemoveGlasses': 'Vui lòng tháo kính xuống',
  'face.errorRemoveMask': 'Vui lòng tháo khẩu trang xuống',
  'face.guideText': 'Vui lòng đưa khuôn mặt vào khung.',
  'face.holding': 'Giữ yên...',

  'document.cccdFront': 'Mặt trước CĂN CƯỚC',
  'document.cccdBack': 'Mặt sau CĂN CƯỚC',
  'document.cccdHint': 'Cần chụp 2 mặt',
  'document.passportFront': 'Mặt trước HỘ CHIẾU',
  'document.passportHint': 'Chỉ cần chụp 1 mặt',
  'document.tabCccd': 'Căn cước',
  'document.tabPassport': 'Hộ chiếu',
  'document.placeHint': 'Đặt giấy tờ nằm ngang trong khung. Đảm bảo rõ nét, không bị chói',
  'document.errorNotRecognized': 'Không ghi nhận được giấy tờ',

  'success.title': 'KHAI BÁO THÀNH CÔNG!',
  'success.subtitle': 'Bạn có thể tiến đến cổng soát vé tự động.',
  'success.ticketLabel': 'Vé',
  'success.restart': 'Định danh vé khác',

  'common.loading': 'Đang tải...',
  'common.loadingCamera': 'Đang khởi động camera...',
  'common.loadingModel': 'Đang tải mô hình nhận diện...',
  'common.uploading': 'Đang tải ảnh lên...',
  'common.unexpectedError': 'Đã có lỗi xảy ra. Vui lòng thử lại.',
  'common.cameraError': 'Không thể truy cập camera.',
} as const;

export type TranslationKey = keyof typeof vi;

const en: Record<TranslationKey, string> = {
  'welcome.title': 'WELCOME TO',
  'welcome.subtitle': 'VERIFY BEFORE PASSING THE GATE',
  'welcome.description': 'Complete 3 steps to receive your e-ID pass and go through the automatic ticket gate.',
  'welcome.step1': 'Scan your ferry ticket QR code',
  'welcome.step2': 'Take a face photo',
  'welcome.step3': 'Capture your ID document',
  'welcome.start': 'Start verification',

  'language.title': 'Select language',
  'language.done': 'Close',

  'qr.title': 'Scan ferry ticket QR',
  'qr.subtitle': 'Next: Face scan',
  'qr.hint': 'Place the QR code in the frame — it will be detected automatically',
  'qr.registering': 'Processing ticket information...',
  'qr.summaryTitle': 'Ticket information',
  'qr.passenger': 'Passenger',
  'qr.idNumber': 'ID/Passport No.',
  'qr.seat': 'Seat/Ferry',
  'qr.departureTime': 'Departure time',
  'qr.route': 'Route',
  'qr.nextStep': 'Next step',
  'qr.rescanHint': 'Scan again if the information is wrong',
  'qr.errorInvalid': 'Invalid QR code',
  'qr.rescan': 'Scan again',
  'qr.home': 'Home',
  'qr.resumeTitle': 'Continue verification?',
  'qr.resumeMessage': "You've already completed the face capture step. Do you want to redo it, or continue to the document capture step?",
  'qr.resumeRedo': 'Redo',
  'qr.resumeContinue': 'Continue',

  'face.title': 'Face photo',
  'face.subtitle': 'Identity verification',
  'face.noSunglasses': 'NO sunglasses',
  'face.noMask': 'NO face mask',
  'face.noHat': 'NO hat',
  'face.verifying': 'Checking face...',
  'face.errorUnclear': 'Face not clear',
  'face.errorMismatch': 'Face does not match',
  'face.errorRemoveHat': 'Please remove your hat',
  'face.errorRemoveGlasses': 'Please remove your glasses',
  'face.errorRemoveMask': 'Please remove your face mask',
  'face.guideText': 'Please place your face in the frame.',
  'face.holding': 'Hold still...',

  'document.cccdFront': 'FRONT of ID card',
  'document.cccdBack': 'BACK of ID card',
  'document.cccdHint': '2 sides required',
  'document.passportFront': 'FRONT of PASSPORT',
  'document.passportHint': 'Only the front side is required',
  'document.tabCccd': 'ID card',
  'document.tabPassport': 'Passport',
  'document.placeHint': "Place the document horizontally in the frame. Make sure it's clear and glare-free",
  'document.errorNotRecognized': 'Document not recognized',

  'success.title': 'CHECK-IN SUCCESSFUL!',
  'success.subtitle': 'You may now proceed to the automatic ticket gate.',
  'success.ticketLabel': 'Ticket',
  'success.restart': 'Verify another passenger',

  'common.loading': 'Loading...',
  'common.loadingCamera': 'Starting camera...',
  'common.loadingModel': 'Loading recognition model...',
  'common.uploading': 'Uploading photo...',
  'common.unexpectedError': 'Something went wrong. Please try again.',
  'common.cameraError': 'Unable to access the camera.',
};

const zh: Record<TranslationKey, string> = {
  'welcome.title': '欢迎来到',
  'welcome.subtitle': '过闸前请先完成验证',
  'welcome.description': '完成以下3个步骤即可获得电子身份通行证并自动通过检票闸机。',
  'welcome.step1': '扫描船票二维码',
  'welcome.step2': '拍摄面部照片',
  'welcome.step3': '拍摄身份证件',
  'welcome.start': '开始验证',

  'language.title': '选择语言',
  'language.done': '关闭',

  'qr.title': '扫描船票二维码',
  'qr.subtitle': '下一步：面部扫描',
  'qr.hint': '请将二维码对准取景框，系统将自动识别',
  'qr.registering': '正在处理船票信息...',
  'qr.summaryTitle': '船票信息',
  'qr.passenger': '乘客姓名',
  'qr.idNumber': '身份证/护照号',
  'qr.seat': '座位/船次',
  'qr.departureTime': '出发时间',
  'qr.route': '航线',
  'qr.nextStep': '下一步',
  'qr.rescanHint': '信息有误请重新扫描',
  'qr.errorInvalid': '二维码无效',
  'qr.rescan': '重新扫描',
  'qr.home': '返回首页',
  'qr.resumeTitle': '继续验证？',
  'qr.resumeMessage': '您已完成面部拍摄步骤。是否要重新拍摄，还是继续进行证件拍摄步骤？',
  'qr.resumeRedo': '重新拍摄',
  'qr.resumeContinue': '继续',

  'face.title': '拍摄面部照片',
  'face.subtitle': '身份验证',
  'face.noSunglasses': '请勿佩戴墨镜',
  'face.noMask': '请勿佩戴口罩',
  'face.noHat': '请勿戴帽子',
  'face.verifying': '正在核验面部信息...',
  'face.errorUnclear': '面部图像不清晰',
  'face.errorMismatch': '面部信息不匹配',
  'face.errorRemoveHat': '请摘下帽子',
  'face.errorRemoveGlasses': '请摘下眼镜',
  'face.errorRemoveMask': '请摘下口罩',
  'face.guideText': '请将面部对准取景框。',
  'face.holding': '请保持不动...',

  'document.cccdFront': '身份证正面',
  'document.cccdBack': '身份证背面',
  'document.cccdHint': '需拍摄正反两面',
  'document.passportFront': '护照资料页',
  'document.passportHint': '仅需拍摄一面',
  'document.tabCccd': '身份证',
  'document.tabPassport': '护照',
  'document.placeHint': '请将证件水平放入取景框，确保清晰且无反光',
  'document.errorNotRecognized': '无法识别证件信息',

  'success.title': '验证成功！',
  'success.subtitle': '您现在可以前往自动检票闸机。',
  'success.ticketLabel': '船票',
  'success.restart': '验证下一位乘客',

  'common.loading': '加载中...',
  'common.loadingCamera': '正在启动摄像头...',
  'common.loadingModel': '正在加载识别模型...',
  'common.uploading': '正在上传照片...',
  'common.unexpectedError': '发生错误，请重试。',
  'common.cameraError': '无法访问摄像头。',
};

const ja: Record<TranslationKey, string> = {
  'welcome.title': 'ようこそ',
  'welcome.subtitle': 'ゲート通過前の本人確認',
  'welcome.description': '3つのステップを完了すると、電子IDパスが発行され、自動改札を通過できます。',
  'welcome.step1': '乗船券のQRコードをスキャン',
  'welcome.step2': '顔写真を撮影',
  'welcome.step3': '身分証明書を撮影',
  'welcome.start': '本人確認を開始',

  'language.title': '言語を選択',
  'language.done': '閉じる',

  'qr.title': '乗船券のQRコードをスキャン',
  'qr.subtitle': '次のステップ：顔認証',
  'qr.hint': 'QRコードをフレーム内に合わせてください。自動で認識されます',
  'qr.registering': '乗船券情報を処理しています...',
  'qr.summaryTitle': '乗船券情報',
  'qr.passenger': '乗客名',
  'qr.idNumber': '身分証/パスポート番号',
  'qr.seat': '座席/便',
  'qr.departureTime': '出発時刻',
  'qr.route': '区間',
  'qr.nextStep': '次へ',
  'qr.rescanHint': '情報が間違っている場合は再スキャンしてください',
  'qr.errorInvalid': 'QRコードが無効です',
  'qr.rescan': '再スキャン',
  'qr.home': 'ホームへ',
  'qr.resumeTitle': '本人確認を続けますか？',
  'qr.resumeMessage': '顔写真の撮影はすでに完了しています。やり直しますか、それとも書類の撮影に進みますか？',
  'qr.resumeRedo': 'やり直す',
  'qr.resumeContinue': '続ける',

  'face.title': '顔写真の撮影',
  'face.subtitle': '本人確認',
  'face.noSunglasses': 'サングラス着用不可',
  'face.noMask': 'マスク着用不可',
  'face.noHat': '帽子着用不可',
  'face.verifying': '顔情報を確認中...',
  'face.errorUnclear': '顔がはっきり写っていません',
  'face.errorMismatch': '顔情報が一致しません',
  'face.errorRemoveHat': '帽子を外してください',
  'face.errorRemoveGlasses': 'メガネを外してください',
  'face.errorRemoveMask': 'マスクを外してください',
  'face.guideText': '顔をフレーム内に合わせてください。',
  'face.holding': 'そのまま動かないでください...',

  'document.cccdFront': '身分証明書（表面）',
  'document.cccdBack': '身分証明書（裏面）',
  'document.cccdHint': '両面の撮影が必要です',
  'document.passportFront': 'パスポート（写真ページ）',
  'document.passportHint': '片面のみで結構です',
  'document.tabCccd': '身分証明書',
  'document.tabPassport': 'パスポート',
  'document.placeHint': '書類を横向きにしてフレーム内に置き、鮮明で反射のない状態にしてください',
  'document.errorNotRecognized': '書類を認識できませんでした',

  'success.title': '確認が完了しました！',
  'success.subtitle': '自動改札へお進みください。',
  'success.ticketLabel': '乗船券',
  'success.restart': '次の乗客の確認へ',

  'common.loading': '読み込み中...',
  'common.loadingCamera': 'カメラを起動しています...',
  'common.loadingModel': '認識モデルを読み込み中...',
  'common.uploading': '写真をアップロード中...',
  'common.unexpectedError': 'エラーが発生しました。もう一度お試しください。',
  'common.cameraError': 'カメラにアクセスできません。',
};

const ko: Record<TranslationKey, string> = {
  'welcome.title': '오신 것을 환영합니다',
  'welcome.subtitle': '게이트 통과 전 본인 확인',
  'welcome.description': '3단계를 완료하면 전자 신분 확인증을 발급받아 자동 개찰구를 통과할 수 있습니다.',
  'welcome.step1': '승선권 QR 코드 스캔',
  'welcome.step2': '얼굴 사진 촬영',
  'welcome.step3': '신분증 촬영',
  'welcome.start': '본인 확인 시작',

  'language.title': '언어 선택',
  'language.done': '닫기',

  'qr.title': '승선권 QR 코드 스캔',
  'qr.subtitle': '다음 단계: 얼굴 인식',
  'qr.hint': 'QR 코드를 프레임 안에 맞추면 자동으로 인식됩니다',
  'qr.registering': '승선권 정보를 처리하는 중...',
  'qr.summaryTitle': '승선권 정보',
  'qr.passenger': '승객 성명',
  'qr.idNumber': '신분증/여권 번호',
  'qr.seat': '좌석/선박',
  'qr.departureTime': '출발 시간',
  'qr.route': '노선',
  'qr.nextStep': '다음 단계',
  'qr.rescanHint': '정보가 잘못된 경우 다시 스캔하세요',
  'qr.errorInvalid': '유효하지 않은 QR 코드입니다',
  'qr.rescan': '다시 스캔',
  'qr.home': '홈으로',
  'qr.resumeTitle': '본인 확인을 계속하시겠습니까?',
  'qr.resumeMessage': '얼굴 사진 촬영 단계를 이미 완료했습니다. 다시 촬영하시겠습니까, 아니면 신분증 촬영 단계로 계속하시겠습니까?',
  'qr.resumeRedo': '다시 촬영',
  'qr.resumeContinue': '계속하기',

  'face.title': '얼굴 사진 촬영',
  'face.subtitle': '본인 확인',
  'face.noSunglasses': '선글라스 착용 금지',
  'face.noMask': '마스크 착용 금지',
  'face.noHat': '모자 착용 금지',
  'face.verifying': '얼굴 정보 확인 중...',
  'face.errorUnclear': '얼굴이 선명하지 않습니다',
  'face.errorMismatch': '얼굴 정보가 일치하지 않습니다',
  'face.errorRemoveHat': '모자를 벗어 주세요',
  'face.errorRemoveGlasses': '안경을 벗어 주세요',
  'face.errorRemoveMask': '마스크를 벗어 주세요',
  'face.guideText': '얼굴을 프레임 안에 맞춰 주세요.',
  'face.holding': '잠시 움직이지 마세요...',

  'document.cccdFront': '신분증 앞면',
  'document.cccdBack': '신분증 뒷면',
  'document.cccdHint': '양면 촬영이 필요합니다',
  'document.passportFront': '여권 정보면',
  'document.passportHint': '한 면만 촬영하면 됩니다',
  'document.tabCccd': '신분증',
  'document.tabPassport': '여권',
  'document.placeHint': '서류를 가로로 프레임 안에 놓고 선명하게, 빛 반사가 없도록 해주세요',
  'document.errorNotRecognized': '서류를 인식할 수 없습니다',

  'success.title': '확인 완료!',
  'success.subtitle': '이제 자동 개찰구로 이동하실 수 있습니다.',
  'success.ticketLabel': '승선권',
  'success.restart': '다음 승객 확인하기',

  'common.loading': '로딩 중...',
  'common.loadingCamera': '카메라를 시작하는 중...',
  'common.loadingModel': '인식 모델을 불러오는 중...',
  'common.uploading': '사진 업로드 중...',
  'common.unexpectedError': '오류가 발생했습니다. 다시 시도해 주세요.',
  'common.cameraError': '카메라에 접근할 수 없습니다.',
};

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { vi, en, zh, ja, ko };

export interface LanguageOption {
  code: Lang;
  label: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
];

const STORAGE_KEY = 'checkin:lang';

function isLang(value: string | null): value is Lang {
  return value === 'vi' || value === 'en' || value === 'zh' || value === 'ja' || value === 'ko';
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLang(stored) ? stored : 'vi';
  });

  const setLang = (next: Lang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const t = (key: TranslationKey) => dictionaries[lang][key];

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return ctx;
}
