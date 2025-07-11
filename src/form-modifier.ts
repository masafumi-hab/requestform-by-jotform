/**
 * このファイルは、クエリパラメータのデータを元にフォームの内容を書き換える機能を提供します。
 */
import type { FieldGroup, FormField } from './jotform-parser.js';

// クエリパラメータから渡されるデータの型定義
interface QueryFieldData {
  [key: string]: string;
}

interface QueryGroupData {
  headerText: string;
  fields: QueryFieldData;
}

interface TopLevelFieldData {
  [key: string]: string;
}

interface PrefillData {
  topLevel?: TopLevelFieldData; // トップレベルのフィールドデータ (オプション)
  groups: QueryGroupData[]; // 既存のグループデータ
}

/**
 * URLのクエリパラメータ 'data' を解析し、Base64デコードしてJSONオブジェクトとして返します。
 * @returns {PrefillData | null} 解析されたデータ。失敗した場合はnull。
 */
export function parseQueryParameters(): PrefillData | null {
  const params = new URLSearchParams(window.location.search);
  let data = params.get('data');
  if (!data) {
    console.log("クエリパラメータ 'data' が見つかりませんでした。");
    return null;
  }

  try {
    const base64 = data.replace(/ /g, '+');
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const decodedString = new TextDecoder().decode(bytes);
    
    console.log("Base64デコードされた文字列:", decodedString);
    
    const parsedData: PrefillData = JSON.parse(decodedString);
    console.log("解析されたPrefillデータ:", parsedData);
    return parsedData;
  } catch (e) {
    console.error('クエリパラメータのデータ解析に失敗しました:', e);
    console.error('エラー詳細:', {
        type: (e as Error).name,
        message: (e as Error).message,
        rawData: params.get('data')
    });
    return null;
  }
}

/**
 * フォームの構造とクエリからのデータを使って、画面の表示を更新します。
 * @param formGroups - jotform-parserから取得したグループ化済みフィールド
 * @param prefillData - クエリパラメータから解析したPrefillデータ (存在しない場合もある)
 */
export function applyDataToForm(formGroups: FieldGroup[], prefillData: PrefillData | null): void {
  // トップレベルフィールドの処理
  if (prefillData && prefillData.topLevel) {
    console.log("トップレベルフィールドの処理を開始します。");
    const topLevel = prefillData.topLevel;

    // お子さんの氏名 (姓)
    if (topLevel['お子さんの氏名_姓']) {
      const firstNameInput = document.getElementById('first_195') as HTMLInputElement;
      if (firstNameInput) {
        console.log(`  - お子さんの氏名 (姓) を設定: ${topLevel['お子さんの氏名_姓']}`);
        firstNameInput.value = topLevel['お子さんの氏名_姓'];
      }
    }
    // お子さんの氏名 (名)
    if (topLevel['お子さんの氏名_名']) {
      const lastNameInput = document.getElementById('last_195') as HTMLInputElement;
      if (lastNameInput) {
        console.log(`  - お子さんの氏名 (名) を設定: ${topLevel['お子さんの氏名_名']}`);
        lastNameInput.value = topLevel['お子さんの氏名_名'];
      }
    }
    // 保護者メールアドレス
    if (topLevel['保護者メールアドレス']) {
      const emailInput = document.getElementById('input_6') as HTMLInputElement;
      if (emailInput) {
        console.log(`  - 保護者メールアドレスを設定: ${topLevel['保護者メールアドレス']}`);
        emailInput.value = topLevel['保護者メールアドレス'];
      }
    }
    // 対象月
    if (topLevel['対象月']) {
      const monthSelect = document.getElementById('input_34') as HTMLSelectElement;
      if (monthSelect) {
        console.log(`  - 対象月を設定: ${topLevel['対象月']}`);
        monthSelect.value = topLevel['対象月'];
      }
    }
    console.log("トップレベルフィールドの処理を完了しました。");
  }

  // フォームに存在するすべてのグループをループ
  formGroups.forEach((targetGroup, index) => {
    // 対応するクエリデータを取得 (存在しない場合は undefined)
    const groupData = prefillData && prefillData.groups ? prefillData.groups[index] : undefined;

    // --- 「リクエスト内容」の動的書き換え処理 ---
    const requestField = targetGroup.childFields.find(f => f.text === 'リクエスト内容');
    
    if (!requestField || !requestField.id) {
        console.warn(`インデックス番号: ${index} のグループは 'リクエスト内容' が見つからないため、処理をスキップしました。`);
        return; 
    }
    
    const requestFieldElement = document.getElementById(requestField.id);
    if (requestFieldElement) {
        // ★★★ 修正点: ラベル書き換えから、不要な要素の削除ロジックに変更 ★★★
        const radioItems = requestFieldElement.querySelectorAll('.form-radio-item');

        // 4つの選択肢が揃っていることを確認してから処理
        if (radioItems.length >= 4) {
            if (groupData) {
                // クエリデータが存在する場合 -> 1番目と2番目を残す
                // 後ろから削除することで、NodeListのインデックスのズレを防ぐ
                radioItems[3].remove(); // 4番目の「追加リクエストなし」を削除
                radioItems[2].remove(); // 3番目の「追加リクエストする」を削除
            } else {
                // クエリデータが存在しない場合 -> 3番目と4番目を残す
                // 後ろから削除することで、NodeListのインデックスのズレを防ぐ
                radioItems[1].remove(); // 2番目の「送迎キャンセル」を削除
                radioItems[0].remove(); // 1番目の「時間/場所の変更」を削除
            }
        }
    }
    
    // --- 値の事前入力処理 (クエリデータが存在する場合のみ) ---
    if (groupData) {
        // 1. ヘッダーテキストの上書き
        if (targetGroup.collapseField.id) {
            const headerElement = document.querySelector(`#${targetGroup.collapseField.id} .form-collapse-mid`);
            if (headerElement && groupData.headerText) {
              headerElement.textContent = groupData.headerText;
            }
        }
    
        // 2. フィールドの値を事前入力
        for (const key in groupData.fields) {
            if (key === 'リクエスト内容') {
                continue;
            }

            let value = groupData.fields[key];
            let targetField: FormField | undefined | null = null;
            
            const normalizedKey = key.replace(/\s/g, '');

            if (normalizedKey === '時' || normalizedKey === '分') {
                if (value.length === 1) {
                  value = '0' + value;
                }
            }
      
            if (key === 'timeOption') {
                targetField = targetGroup.childFields.find(f => f.text === null);
            } else {
                targetField = targetGroup.childFields.find(f => 
                    f.text?.replace(/\s/g, '') === normalizedKey
                );
            }
      
            if (targetField && targetField.id) {
                const fieldElement = document.getElementById(targetField.id);
                if (fieldElement) {
                    if (targetField.type === 'control_datetime') {
                        console.log(`日付フィールド(id: ${targetField.id})の値を設定します。値: ${value}`);
                        // 表示されている日付入力フィールドに値を設定
                        const visibleDateInput = fieldElement.querySelector<HTMLInputElement>('input[id^="lite_mode_"]');
                        if (visibleDateInput) {
                            visibleDateInput.value = value;
                            console.log(`  - 表示用input (id: ${visibleDateInput.id}) の値を更新しました。`);
                        }

                        // Jotformの送信に使われる隠しフィールド（年/月/日）にも値を設定
                        const dateParts = value.split('-');
                        if (dateParts.length === 3) {
                            const [year, month, day] = dateParts;
                            console.log(`  - 日付を分割しました: year=${year}, month=${month}, day=${day}`);
                            
                            // name属性を元に、該当グループ内の年/月/日のinputを特定する
                            const yearInput = fieldElement.querySelector<HTMLInputElement>('input[name$="[year]"]');
                            const monthInput = fieldElement.querySelector<HTMLInputElement>('input[name$="[month]"]');
                            const dayInput = fieldElement.querySelector<HTMLInputElement>('input[name$="[day]"]');

                            if (yearInput) {
                                console.log(`  - [変更前] 隠しフィールド (年, name: ${yearInput.name}) の値:`, yearInput.value);
                                yearInput.value = year;
                                console.log(`  - [変更後] 隠しフィールド (年, name: ${yearInput.name}) の値:`, yearInput.value);
                            }
                            if (monthInput) {
                                console.log(`  - [変更前] 隠しフィールド (月, name: ${monthInput.name}) の値:`, monthInput.value);
                                monthInput.value = month;
                                console.log(`  - [変更後] 隠しフィールド (月, name: ${monthInput.name}) の値:`, monthInput.value);
                            }
                            if (dayInput) {
                                console.log(`  - [変更前] 隠しフィールド (日, name: ${dayInput.name}) の値:`, dayInput.value);
                                dayInput.value = day;
                                console.log(`  - [変更後] 隠しフィールド (日, name: ${dayInput.name}) の値:`, dayInput.value);
                            }
                        }
                    } else {
                        const input = fieldElement.querySelector('input, select, textarea');
                        if (input) {
                            switch(input.tagName.toLowerCase()) {
                                case 'select':
                                (input as HTMLSelectElement).value = value;
                                break;
                                case 'input':
                                const inputType = (input as HTMLInputElement).type;
                                if (inputType === 'radio') {
                                    const radioGroup = document.querySelectorAll<HTMLInputElement>(`input[name="${(input as HTMLInputElement).name}"][value="${value}"]`);
                                    if (radioGroup.length > 0) {
                                        radioGroup[0].checked = true;
                                    }
                                } else {
                                    (input as HTMLInputElement).value = value;
                                }
                                break;
                                default:
                                (input as HTMLTextAreaElement | HTMLSelectElement).value = value;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
  });
}
