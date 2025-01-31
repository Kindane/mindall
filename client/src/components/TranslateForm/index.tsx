import React, { useEffect, useState } from "react";
import styles from "./styles.module.css";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import ClearIcon from "@mui/icons-material/Clear";
import axios from "axios";

import { useAlert } from "react-alert";
import { useParams } from "react-router-dom";

function copyText(t: string) {
    try {
        navigator.clipboard.writeText(t);
    } catch {
        const el = document.createElement("textarea");
        el.value = t;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        el.setSelectionRange(0, 99999);
        document.execCommand("copy");
        document.body.removeChild(el);
    }
}

export default function TranslateForm({
    selected,
    save: saveToLocalStorage,
    onShareUpdate,
}: {
    selected: Translation;
    save: (arg1: Translation) => any;
    onShareUpdate: (update: { originalText: string; isEncoding: boolean } | null) => any;
}) {
    const alert = useAlert();
    const params = useParams<{ id: string }>();
    const [originalText, setOriginalText] = useState<string>(selected.originalText);
    const [translatedText, setTranslatedText] = useState<string>(selected.translatedText);
    // Should we encode or decode?
    const [isEncoding, setEncoding] = useState<boolean>(selected.isEncoding);
    // Used to request API with delay
    const [typingTimeout, setTypingTimeout] = useState<any>();
    // Used to prevent requesting already known value from history
    const [isPastedFromHistory, setIsPastedFromHistory] = useState<boolean>(false);

    async function getShare() {
        const res = await axios.get(`${process.env.REACT_APP_DOMAIN}/share/${params.id}`).catch((e) => {
            alert.error(e.response.data.message);
        });
        if (res) {
            setOriginalText(res.data.originalText);
            setEncoding(res.data.isEncoding);
        }
    }

    useEffect(() => {
        if (params.id) {
            getShare();
        }
    }, []);

    useEffect(() => {
        const from = document.querySelector("textarea#from") as HTMLTextAreaElement;
        const to = document.querySelector("textarea#to") as HTMLTextAreaElement;

        from.placeholder = isEncoding ? "Текст..." : "Код...";
        to.placeholder = isEncoding ? "Код..." : "Текст...";
    }, [isEncoding]);

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        // Should request only if new text was passed to the input
        // (Means excluding something pasted from history (exception: translated text is empty) or just swapped already encoded value)
        if (originalText && (!isPastedFromHistory || !translatedText)) {
            // Timeout is used to give user some time to end the phrase
            if (typingTimeout) clearTimeout(typingTimeout);
            setTypingTimeout(
                setTimeout(async () => {
                    try {
                        const { data } = await axios.post(`${process.env.REACT_APP_DOMAIN}/cipher/${isEncoding ? "encode" : "decode"}`, {
                            original: originalText,
                        });
                        setTranslatedText(data.result);

                        saveToLocalStorage({
                            translatedText: data.result,
                            originalText,
                            isEncoding,
                        });
                    } catch (e: any) {
                        // @ts-ignore
                        if (e?.response?.data?.error) {
                            alert.error("Неверный код.");
                            onShareUpdate(null);
                        }
                    }
                }, 1000)
            );
        } else {
            // Clear translated text if original text is none
            if (translatedText && !isPastedFromHistory) setTranslatedText("");
            clearTimeout(typingTimeout);
        }

        // After we checked current original text update, we can drop all indicators for text
        // So we know that the next text change will be ok to translate
        setIsPastedFromHistory(false);
    }, [originalText, isEncoding]);

    useEffect(() => {
        onShareUpdate(translatedText ? { originalText, isEncoding } : null);
    }, [translatedText]);

    useEffect(() => {
        setIsPastedFromHistory(true);
        setEncoding(selected?.isEncoding);
        setOriginalText(selected.originalText);
        setTranslatedText(selected.translatedText);
    }, [selected]);

    function swapModes() {
        if (translatedText && originalText) {
            const original = originalText;
            setOriginalText(translatedText);
            setTranslatedText(original);
        }
        setEncoding(!isEncoding);
    }

    function copyTranslated() {
        if (translatedText) {
            copyText(translatedText);
            alert.show("Текст скопирован в буфер обмена.");
        }
    }

    function copyShared() {
        const text = encodeURIComponent(originalText);
        const shareUrl = `https://mindall.herokuapp.com/?t=${text}&d=${Number(!isEncoding)}`;
        copyText(shareUrl);
        alert.show("Ссылка скопирована в буффер обмена");
    }

    function clearFields() {
        setOriginalText("");
    }

    return (
        <div className={styles["translate-form"]}>
            <div className={styles["mode-swapper"]}>
                <span>{isEncoding ? "Текст" : "Код"}</span>
                <SwapHorizIcon onClick={swapModes} />
                <span>{isEncoding ? "Код" : "Текст"}</span>
            </div>

            <div className={styles.results}>
                <textarea
                    id="from"
                    className={styles.input}
                    cols={40}
                    rows={10}
                    placeholder="Текст..."
                    value={originalText}
                    onChange={(e) => setOriginalText(e.target.value)}
                ></textarea>
                <textarea
                    id="to"
                    className={styles.output}
                    cols={40}
                    rows={10}
                    readOnly
                    placeholder="Код..."
                    value={translatedText}
                ></textarea>
                <div className={styles["menu-buttons"]}>
                    <ClearIcon onClick={clearFields} />
                    <ContentPasteIcon onClick={copyTranslated} />
                </div>
            </div>
        </div>
    );
}
