import { Context } from "telegraf";
import { SceneSession, SceneSessionData } from "telegraf/typings/scenes";

export interface IBotContext extends Context {
  session: SceneSession<SceneSessionData> & {
    answers?: Record<string, string>;
    currentQuestion?: number;
    editing?: boolean;
    editingQuestion?: number;
  };
  scene: {
    state: {
      schedulingSubmissionId?: string;
    };
  };
}
