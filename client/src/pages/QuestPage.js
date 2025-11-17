import React, { useState, useEffect } from "react";
import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../hooks/useAuth";
import './QuestPage.css';

const getQuestStatus = httpsCallable(functions, "getQuestStatus");

const getBadgeClass = (badge) => {
  switch (badge) {
    case "실버": return "badge-silver";
    case "골드": return "badge-gold";
    case "마스터": return "badge-master";
    default: return "";
  }
};

const QuestItem = ({ title, description, status, progressValue, progressMax }) => {
  const getStatusChip = () => {
    switch (status) {
      case "completed": return <span className="chip chip-success">완료</span>;
      case "in_progress": return <span className="chip chip-primary">진행 중</span>;
      case "locked": return <span className="chip">잠김</span>;
      default: return null;
    }
  };

  return (
    <div className={`quest-item quest-item-${status}`}>
      <div className="quest-item-header">
        <h5>{title}</h5>
        {getStatusChip()}
      </div>
      <p className="quest-item-description">{description}</p>
      {status === "in_progress" && progressMax > 0 && (
        <div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${(progressValue / progressMax) * 100}%` }}></div>
          </div>
          <p className="progress-text">{progressValue} / {progressMax}</p>
        </div>
      )}
    </div>
  );
};

function QuestPage() {
  const { user } = useAuth();
  const [questData, setQuestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      setLoading(true);
      getQuestStatus()
        .then((result) => {
          if (result.data.success) setQuestData(result.data);
          else throw new Error("데이터를 불러오는 데 실패했습니다.");
        })
        .catch((err) => {
          console.error("퀘스트 정보 조회 오류:", err);
          setError(err.message);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) return <div className="loading-spinner"></div>;
  if (!user) return <div className="alert alert-warning">퀘스트 정보를 보려면 로그인이 필요합니다.</div>;
  if (error) return <div className="alert alert-error">오류: {error}</div>;
  if (!questData) return <p>퀘스트 정보를 불러올 수 없습니다.</p>;

  const { badge, progress } = questData;

  return (
    <div className="quest-container">
      <div className="quest-header">
        <h2>나의 퀘스트 현황</h2>
      </div>
      <div className="user-badge-container">
        <h3>나의 배지:</h3>
        <span className={`badge ${getBadgeClass(badge)}`}>{badge || "없음"}</span>
      </div>

      <div className="quest-category">
        <h4>초급 퀘스트</h4>
        <QuestItem title="첫 구매 시작" description="3개 이상의 종목을 매수해 보세요." status={progress.beginner_status} progressValue={progress.portfolio_diversity} progressMax={3} />
      </div>

      <div className="quest-category">
        <h4>중급 퀘스트</h4>
        <QuestItem title="10% 수익률 달성" description="총 자산 수익률 10%를 달성하여 투자의 결실을 맺어보세요." status={progress.intermediate_status} progressValue={progress.profit_rate_achieved ? 1 : 0} progressMax={1} />
        <QuestItem title="O/X 예측의 달인" description="O/X 예측에 5회 이상 참여하여 정답을 맞혀보세요." status={progress.intermediate_status} progressValue={progress.ox_correct_answers} progressMax={5} />
      </div>

      <div className="quest-category">
        <h4>고급 퀘스트</h4>
        <QuestItem title="시즌 랭킹 TOP 10" description="시즌이 종료될 때, 최종 랭킹 10위 안에 들어 당신의 실력을 증명하세요." status={progress.advanced_status} progressValue={0} progressMax={0} />
      </div>
    </div>
  );
}

export default QuestPage;

