// client/src/pages/QuestPage.js
import React, {useState, useEffect} from "react";
import {functions} from "../firebase";
import {httpsCallable} from "firebase/functions";
import {useAuth} from "../hooks/useAuth";
import {Box, Typography, Paper, Chip, LinearProgress, CircularProgress, Alert} from "@mui/material";

// 퀘스트 데이터를 가져오는 함수
const getQuestStatus = httpsCallable(functions, "getQuestStatus");

// 배지 색상을 결정하는 헬퍼 함수
const getBadgeColor = (badge) => {
  switch (badge) {
    case "실버":
      return "silver";
    case "골드":
      return "gold";
    case "마스터":
      return "purple";
    default:
      return "grey";
  }
};

// 퀘스트 상태에 따른 UI를 렌더링하는 컴포넌트
const QuestItem = ({title, description, status, progressValue, progressMax}) => {
  const getStatusChip = () => {
    switch (status) {
      case "completed":
        return <Chip label="완료" color="success" size="small" />;
      case "in_progress":
        return <Chip label="진행 중" color="primary" size="small" />;
      case "locked":
        return <Chip label="잠김" color="default" size="small" />;
      default:
        return null;
    }
  };

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        opacity: status === "locked" ? 0.5 : 1,
        borderLeft: `5px solid ${status === "completed" ? "green" : status === "in_progress" ? "blue" : "grey"}`,
      }}
    >
      <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <Typography variant="h6">{title}</Typography>
        {getStatusChip()}
      </Box>
      <Typography variant="body2" color="textSecondary" sx={{mt: 1}}>
        {description}
      </Typography>
      {status === "in_progress" && progressMax > 0 && (
        <Box sx={{mt: 1.5}}>
          <LinearProgress
            variant="determinate"
            value={(progressValue / progressMax) * 100}
            sx={{height: 8, borderRadius: 5}}
          />
          <Typography variant="caption" align="right" component="div">
            {progressValue} / {progressMax}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

function QuestPage() {
  const {user} = useAuth();
  const [questData, setQuestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      setLoading(true);
      getQuestStatus()
        .then((result) => {
          if (result.data.success) {
            setQuestData(result.data);
          } else {
            throw new Error("데이터를 불러오는 데 실패했습니다.");
          }
        })
        .catch((err) => {
          console.error("퀘스트 정보 조회 오류:", err);
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <Box sx={{display: "flex", justifyContent: "center", mt: 4}}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Alert severity="warning">퀘스트 정보를 보려면 로그인이 필요합니다.</Alert>;
  }

  if (error) {
    return <Alert severity="error">오류: {error}</Alert>;
  }

  if (!questData) {
    return <Typography>퀘스트 정보를 불러올 수 없습니다.</Typography>;
  }

  const {badge, progress} = questData;

  return (
    <Box sx={{maxWidth: 800, margin: "auto"}}>
      <Typography variant="h4" gutterBottom>
        나의 퀘스트 현황
      </Typography>

      <Paper elevation={3} sx={{p: 2, mb: 4, display: "flex", alignItems: "center", gap: 2}}>
        <Typography variant="h6">나의 배지:</Typography>
        <Chip
          label={badge || "없음"}
          sx={{
            backgroundColor: getBadgeColor(badge),
            color: badge === "마스터" ? "white" : "black",
            fontWeight: "bold",
          }}
        />
      </Paper>

      {/* 초급 퀘스트 */}
      <Box mb={4}>
        <Typography variant="h5" gutterBottom>
          초급 퀘스트
        </Typography>
        <QuestItem
          title="포트폴리오 다각화"
          description="포트폴리오에 3개 이상의 다양한 종목을 보유하여 위험을 분산시키세요."
          status={progress.beginner_status}
          progressValue={progress.portfolio_diversity}
          progressMax={3}
        />
      </Box>

      {/* 중급 퀘스트 */}
      <Box mb={4}>
        <Typography variant="h5" gutterBottom>
          중급 퀘스트
        </Typography>
        <QuestItem
          title="10% 수익률 달성"
          description="총 자산 수익률 10%를 달성하여 투자의 결실을 맺어보세요."
          status={progress.intermediate_status}
          progressValue={progress.profit_rate_achieved ? 1 : 0}
          progressMax={1}
        />
        <QuestItem
          title="O/X 예측의 달인"
          description="O/X 예측에 5회 이상 참여하여 정답을 맞혀보세요."
          status={progress.intermediate_status}
          progressValue={progress.ox_correct_answers}
          progressMax={5}
        />
      </Box>

      {/* 고급 퀘스트 */}
      <Box>
        <Typography variant="h5" gutterBottom>
          고급 퀘스트
        </Typography>
        <QuestItem
          title="시즌 랭킹 TOP 10"
          description="시즌이 종료될 때, 최종 랭킹 10위 안에 들어 당신의 실력을 증명하세요."
          status={progress.advanced_status}
          progressValue={0} // 이 퀘스트는 시즌 마감 시 한 번에 결정되므로 진행도 바가 없음
          progressMax={0}
        />
      </Box>
    </Box>
  );
}

export default QuestPage;
